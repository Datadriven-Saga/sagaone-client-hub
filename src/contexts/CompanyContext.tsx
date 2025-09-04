import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface Company {
  id: string;
  nome_empresa: string;
  razao_social: string;
}

interface CompanyContextType {
  activeCompany: Company | null;
  userCompanies: Company[];
  loading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserCompanies = async () => {
    if (!user) {
      console.warn('CompanyContext: No user found, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('CompanyContext: Fetching companies for user:', user.id);

    try {
      // Get user's companies with better error handling
      const { data: userEmpresasData, error: userEmpresasError } = await supabase
        .from('user_empresas')
        .select(`
          empresa_id,
          is_ativa,
          empresas:empresa_id (
            id,
            nome_empresa,
            razao_social
          )
        `)
        .eq('user_id', user.id);

      console.log('CompanyContext: Raw data response:', userEmpresasData);
      console.log('CompanyContext: Error response:', userEmpresasError);

      if (userEmpresasError) {
        console.error('CompanyContext: Supabase error:', userEmpresasError);
        throw userEmpresasError;
      }

      if (!userEmpresasData || userEmpresasData.length === 0) {
        console.warn('CompanyContext: No companies found for user');
        setUserCompanies([]);
        setActiveCompany(null);
        setLoading(false);
        return;
      }

      const companies = userEmpresasData
        ?.map(ue => ue.empresas)
        .filter(Boolean) || [];
      
      const activeCompanyData = userEmpresasData
        ?.find(ue => ue.is_ativa)?.empresas;

      console.log('CompanyContext: Processed companies:', companies);
      console.log('CompanyContext: Active company:', activeCompanyData);

      setUserCompanies(companies as Company[]);
      setActiveCompany(activeCompanyData as Company || null);
      
      if (companies.length > 0 && !activeCompanyData) {
        console.warn('CompanyContext: No active company found, but companies exist');
      }
    } catch (error) {
      console.error('CompanyContext: Error fetching user companies:', error);
      toast.error('Erro ao carregar empresas: ' + (error as Error).message);
      // Set empty state on error
      setUserCompanies([]);
      setActiveCompany(null);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      console.log('CompanyContext: Switching to company:', companyId);
      
      const { error } = await supabase.rpc('set_user_active_company', {
        new_empresa_id: companyId
      });

      if (error) {
        console.error('CompanyContext: RPC error:', error);
        throw error;
      }

      const newActiveCompany = userCompanies.find(c => c.id === companyId);
      setActiveCompany(newActiveCompany || null);
      toast.success('Empresa alterada com sucesso');
      
      // Refresh the page to update all data based on new company
      window.location.reload();
    } catch (error) {
      console.error('CompanyContext: Error switching company:', error);
      toast.error('Erro ao trocar empresa: ' + (error as Error).message);
    }
  };

  const refreshCompanies = async () => {
    await fetchUserCompanies();
  };

  useEffect(() => {
    if (user) {
      fetchUserCompanies();
    } else {
      setActiveCompany(null);
      setUserCompanies([]);
      setLoading(false);
    }
  }, [user]);

  const value = {
    activeCompany,
    userCompanies,
    loading,
    switchCompany,
    refreshCompanies,
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
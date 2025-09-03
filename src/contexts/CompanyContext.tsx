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
    if (!user) return;

    try {
      // Get user's companies
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

      if (userEmpresasError) throw userEmpresasError;

      const companies = userEmpresasData?.map(ue => ue.empresas).filter(Boolean) || [];
      const activeCompanyData = userEmpresasData?.find(ue => ue.is_ativa)?.empresas;

      setUserCompanies(companies as Company[]);
      setActiveCompany(activeCompanyData as Company || null);
    } catch (error) {
      console.error('Error fetching user companies:', error);
      toast.error('Erro ao carregar empresas do usuário');
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = async (companyId: string) => {
    try {
      const { error } = await supabase.rpc('set_user_active_company', {
        new_empresa_id: companyId
      });

      if (error) throw error;

      const newActiveCompany = userCompanies.find(c => c.id === companyId);
      setActiveCompany(newActiveCompany || null);
      toast.success('Empresa alterada com sucesso');
      
      // Refresh the page to update all data based on new company
      window.location.reload();
    } catch (error) {
      console.error('Error switching company:', error);
      toast.error('Erro ao trocar empresa');
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
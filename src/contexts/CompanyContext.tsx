import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface Company {
  id: string;
  nome_empresa: string;
  marca?: string | null;
  uf?: string | null;
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

  const fetchUserCompanies = useCallback(async () => {
    if (!user?.id) {
      console.warn('🏢 CompanyContext: No user found, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('🏢 CompanyContext: Fetching companies for user:', user.id, user.email);

    try {
      // Get user's companies with better error handling
      const { data: userEmpresasData, error: userEmpresasError } = await supabase
        .from('user_empresas')
        .select(`
          empresa_id,
          is_ativa,
          empresas!inner (
            id,
            nome_empresa,
            marca,
            uf
          )
        `)
        .eq('user_id', user.id);

      console.log('🏢 CompanyContext: user_empresas query result:', {
        data: userEmpresasData,
        error: userEmpresasError,
        userEmpresasCount: userEmpresasData?.length || 0
      });

      if (userEmpresasError) {
        console.error('🏢 CompanyContext: Error fetching user empresas:', userEmpresasError);
        throw userEmpresasError;
      }

      const companies = (userEmpresasData || [])
        .filter(ue => ue.empresas) // Filter out null empresas
        .map(ue => ({
          id: ue.empresas.id,
          nome_empresa: ue.empresas.nome_empresa,
          marca: (ue.empresas as any).marca ?? null,
          uf: (ue.empresas as any).uf ?? null,
        }));

      console.log('🏢 CompanyContext: Processed companies:', companies);

      setUserCompanies(companies);

      // Find the active company
      const activeEmpresa = userEmpresasData?.find(ue => ue.is_ativa && ue.empresas);
      console.log('🏢 CompanyContext: Active empresa found:', activeEmpresa);

      if (activeEmpresa && activeEmpresa.empresas) {
        const activeCompanyData = {
          id: activeEmpresa.empresas.id,
          nome_empresa: activeEmpresa.empresas.nome_empresa,
          marca: (activeEmpresa.empresas as any).marca ?? null,
          uf: (activeEmpresa.empresas as any).uf ?? null,
        };
        console.log('🏢 CompanyContext: Setting active company:', activeCompanyData);
        setActiveCompany(activeCompanyData);
      } else if (companies.length > 0) {
        // No active company found, activate the first one automatically
        console.warn('🏢 CompanyContext: No active company found, activating first company');
        const firstCompany = companies[0];
        
        // Set active in database
        const { error: activateError } = await supabase.rpc('set_user_active_company', {
          new_empresa_id: firstCompany.id
        });
        
        if (activateError) {
          console.error('🏢 CompanyContext: Error activating first company:', activateError);
        } else {
          console.log('🏢 CompanyContext: First company activated:', firstCompany);
        }
        
        setActiveCompany(firstCompany);
      } else {
        console.warn('🏢 CompanyContext: No companies found');
        setActiveCompany(null);
      }
    } catch (error) {
      console.error('🏢 CompanyContext: Error in fetchUserCompanies:', error);
      toast.error('Erro ao carregar empresas: ' + (error as Error).message);
      setUserCompanies([]);
      setActiveCompany(null);
    } finally {
      setLoading(false);
      console.log('🏢 CompanyContext: Fetch completed, loading set to false');
    }
  }, [user?.id]);

  const switchCompany = useCallback(async (companyId: string) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      console.log('🏢 CompanyContext: Switching to company:', companyId);
      
      const { error } = await supabase.rpc('set_user_active_company', {
        new_empresa_id: companyId
      });

      if (error) {
        console.error('🏢 CompanyContext: RPC error:', error);
        throw error;
      }

      const newActiveCompany = userCompanies.find(c => c.id === companyId);
      setActiveCompany(newActiveCompany || null);
      toast.success('Empresa alterada com sucesso');
      
      // Refresh the page to update all data based on new company
      window.location.reload();
    } catch (error) {
      console.error('🏢 CompanyContext: Error switching company:', error);
      toast.error('Erro ao trocar empresa: ' + (error as Error).message);
    }
  }, [userCompanies]);

  const refreshCompanies = useCallback(async () => {
    await fetchUserCompanies();
  }, [fetchUserCompanies]);

  useEffect(() => {
    console.log('🏢 CompanyContext: useEffect triggered, user ID:', user?.id);
    if (user?.id) {
      fetchUserCompanies();
    } else {
      console.log('🏢 CompanyContext: No user, clearing state');
      setActiveCompany(null);
      setUserCompanies([]);
      setLoading(false);
    }
  }, [user?.id, fetchUserCompanies]);

  const value = useMemo(() => ({
    activeCompany,
    userCompanies,
    loading,
    switchCompany,
    refreshCompanies,
  }), [activeCompany, userCompanies, loading, switchCompany, refreshCompanies]);

  console.log('🏢 CompanyContext: Rendering with state:', {
    activeCompany: activeCompany?.nome_empresa,
    userCompaniesCount: userCompanies.length,
    loading: loading
  });

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
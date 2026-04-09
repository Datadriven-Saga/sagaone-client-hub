import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import {
  getDefaultPermissions,
  resolvePermissions,
  type TipoAcesso,
} from "@/components/controle-acessos/PermissionRegistry";

type TipoAcessoDB = Database["public"]["Enums"]["tipo_acesso"];

export function useUserAccessType() {
  const { user } = useAuth();
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcessoDB | null>(null);
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setTipoAcesso(null);
        setDepartamento(null);
        setPermissions({});
        setLoading(false);
        return;
      }

      try {
        // Fetch profile and permission overrides in parallel
        const [profileRes, overridesRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("tipo_acesso, departamento")
            .eq("id", user.id)
            .single(),
          supabase
            .from("departamento_permissoes")
            .select("departamento, permissao, ativo"),
        ]);

        const tipo = profileRes.data?.tipo_acesso ?? null;
        const dept = profileRes.data?.departamento ?? null;

        setTipoAcesso(tipo);
        setDepartamento(dept);

        if (tipo) {
          // Build overrides map for this user's tipo_acesso
          const allOverrides: Record<string, Record<string, boolean>> = {};
          overridesRes.data?.forEach((row) => {
            if (!allOverrides[row.departamento]) allOverrides[row.departamento] = {};
            allOverrides[row.departamento][row.permissao] = row.ativo;
          });

          const myOverrides = allOverrides[tipo as string] || {};
          const resolved = resolvePermissions(tipo as TipoAcesso, myOverrides);
          
          setPermissions(resolved);
        } else {
          setPermissions({});
        }
      } catch (err) {
        console.error("Erro ao buscar tipo de acesso/permissões:", err);
        setTipoAcesso(null);
        setDepartamento(null);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Derived role flags (kept for backward compatibility)
  const isMasterRole = tipoAcesso === "Master";
  const isAdmin = tipoAcesso === "Administrador" || isMasterRole;
  const isTI = tipoAcesso === "TI";
  const isAdminOrTI = isAdmin || isTI;

  const isDiretor = tipoAcesso === "Diretor";
  const isGerenteLeads = tipoAcesso === "Gerente de Leads";
  const isGerenteLoja = tipoAcesso === "Gerente de Loja";
  const isCoordenadoraLeads = tipoAcesso === "Coordenadora de Leads";
  const isGerente = isGerenteLeads || isGerenteLoja || isCoordenadoraLeads;
  const isCRM = tipoAcesso === "CRM";
  const isRecepcionista = tipoAcesso === "Recepcionista";
  const isVendedor = tipoAcesso === "Vendedor";
  const isSDR = tipoAcesso === "SDR";
  const isProprietario = tipoAcesso === "Proprietário";

  const isDepartamentoTI = (departamento ?? "").trim().toUpperCase() === "TI";

  // Helper to get permission from resolved map with fallback
  const p = (key: string): boolean => permissions[key] ?? false;

  return {
    tipoAcesso,
    departamento,
    loading,
    // Role flags
    isMasterRole,
    isAdmin,
    isTI,
    isAdminOrTI,
    isDiretor,
    isGerente,
    isCRM,
    isCoordenadoraLeads,
    isRecepcionista,
    isVendedor,
    isSDR,
    isProprietario,
    isDepartamentoTI,

    // All permissions now driven by Permission Flags (departamento_permissoes)
    canAccessAgentesIA: p("canAccessAgentesIA"),
    canCreateIALigacao: p("canCreateIALigacao"),
    canToggleIALigacao: p("canToggleIALigacao"),
    canCreateEventos: p("canCreateEventos"),
    canEditEventos: p("canEditEventos"),
    canDeleteEventos: p("canDeleteEventos"),
    canUploadBase: p("canUploadBase"),
    canDispararIALigacao: p("canDispararIALigacao"),
    canDispararEventos: p("canDispararEventos"),
    canManageEventos: p("canManageEventos"),
    canManageProspeccaoEquipes: p("canManageProspeccaoEquipes"),
    canAprovarCampanhas: p("canAprovarCampanhas"),
    canValidarImportacao: p("canValidarImportacao"),
    canProgramarCampanhas: p("canProgramarCampanhas"),
    canGovernancaDados: p("canGovernancaDados"),
    canCreateUsers: p("canCreateUsers"),

    // Specific permissions
    canAddClientes: p("canAddClientes"),
    canDeleteContatos: p("canDeleteContatos"),
    canAccessRecepcao: p("canAccessRecepcao"),
    canReadQRCode: p("canReadQRCode"),
    canManageUsers: p("canManageUsers"),
    canAccessAdminConfig: p("canAccessAdminConfig"),
    canAccessFinancialReports: p("canAccessFinancialReports"),
    canAccessKanban: p("canAccessKanban"),
    canManageEvents: p("canManageEvents"),
    canImportClientes: p("canImportClientes"),
    canGenerateInvites: p("canGenerateInvites"),
    canCreateTemplates: p("canCreateTemplates"),
    canEditUsers: p("canEditUsers"),
    canDeleteUsers: p("canDeleteUsers"),
    canViewProspeccao: p("canViewProspeccao"),
    canViewVendas: p("canViewVendas"),
    canAccessNotificacoes: p("canAccessNotificacoes"),
    canAccessMinhaConta: p("canAccessMinhaConta"),
    canAccessAjuda: p("canAccessAjuda"),

    // MFA / Authenticator permissions
    canViewAuthenticator: p("canViewAuthenticator"),
    canManageAuthenticator: p("canManageAuthenticator"),
    canAssignAuthenticator: p("canAssignAuthenticator"),
    canViewAuditLogs: p("canViewAuditLogs"),

    // Full permissions map for granular checks
    permissions,
  };
}

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type TipoAcesso = Database["public"]["Enums"]["tipo_acesso"];

export function useUserAccessType() {
  const { user } = useAuth();
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso | null>(null);
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTipoAcesso = async () => {
      if (!user) {
        setTipoAcesso(null);
        setDepartamento(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("tipo_acesso, departamento")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar tipo de acesso/departamento:", error);
          setTipoAcesso(null);
          setDepartamento(null);
        } else {
          setTipoAcesso(data?.tipo_acesso ?? null);
          setDepartamento(data?.departamento ?? null);
        }
      } catch (err) {
        console.error("Erro ao buscar tipo de acesso/departamento:", err);
        setTipoAcesso(null);
        setDepartamento(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTipoAcesso();
  }, [user]);

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

  // Permissões para adicionar clientes: Administrador, CRM
  const canAddClientes = isAdmin || isCRM;

  // Permissões para acessar Recepção: Administrador, Recepcionista
  const canAccessRecepcao = isAdmin || isRecepcionista;

  // Permissões para ler QR Code/check-in: Administrador, Recepcionista
  const canReadQRCode = isAdmin || isRecepcionista;

  // Permissões para gerenciar usuários: Administrador, TI
  const canManageUsers = isAdminOrTI;

  // Permissões para acessar configurações administrativas: Administrador, TI
  const canAccessAdminConfig = isAdminOrTI;

  // Permissões para acessar relatórios financeiros: Administrador, TI, Diretor, Proprietário
  const canAccessFinancialReports = isAdmin || isTI || isDiretor || isProprietario;

  // Permissões para acessar Kanban de atendimentos: todos EXCETO Recepcionista
  const canAccessKanban = !isRecepcionista;

  // Permissões para criar/editar/excluir eventos: todos EXCETO Recepcionista
  const canManageEvents = !isRecepcionista;

  // Permissões para adicionar clientes manualmente/importar: Administrador, TI, CRM
  const canImportClientes = isAdmin || isTI || isCRM;

  // Permissões para gerar convites/QR Codes: todos EXCETO Recepcionista
  const canGenerateInvites = !isRecepcionista;

  // Permissões para criar templates: Administrador, TI, Gerente de Leads, CRM
  const canCreateTemplates = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM;

  // Permissão específica para área de TI (Agentes IA / Instâncias)
  const canAccessAgentesIA = isDepartamentoTI && isAdminOrTI;

  // Permissão para criar eventos (incluindo ligação): Administrador, TI, Gerente de Leads, Coordenadora de Leads, CRM
  const canCreateEventos = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM;

  // Permissão para criar eventos de IA Ligação: Administrador, TI, Gerente de Leads, Coordenadora de Leads
  const canCreateIALigacao = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads;

  // Permissão para subir base de leads: Administrador, TI, CRM, Gerente de Leads, Coordenadora de Leads, Gerente de Loja
  const canUploadBase = isAdmin || isTI || isCRM || isGerenteLeads || isCoordenadoraLeads || isGerenteLoja;

  // Permissão para disparar eventos de IA Ligação: Administrador, TI
  const canDispararIALigacao = isAdminOrTI;

  // Permissão para disparar outros eventos: Administrador, TI, Gerente de Leads, Coordenadora de Leads, CRM
  const canDispararEventos = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM;

  // Permissão para gerenciar eventos (editar/excluir): Administrador, TI
  const canManageEventos = isAdminOrTI;

  // Permissão para gerenciar equipes de prospecção: Admin, TI, Gerente de Leads, Coordenadora de Leads, CRM, Gerente de Loja
  const canManageProspeccaoEquipes = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM || isGerenteLoja;

  // Permissão para aprovar/reprovar campanhas: Administrador, TI, CRM (NÃO Gestor de Leads)
  const canAprovarCampanhas = isAdmin || isTI || isCRM;

  // Permissão para validar importações de base: Administrador, TI, CRM
  const canValidarImportacao = isAdmin || isTI || isCRM;

  // Permissão para programar campanhas: Administrador, TI, Gerente de Leads, Coordenadora de Leads, CRM
  const canProgramarCampanhas = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM;

  // Permissão para governança de dados: Administrador, TI, CRM
  const canGovernancaDados = isAdmin || isTI || isCRM;

  // Permissão para criar usuários: Administrador, TI, Gerente de Leads, Coordenadora de Leads, CRM
  const canCreateUsers = isAdminOrTI || isGerenteLeads || isCoordenadoraLeads || isCRM;

  return {
    tipoAcesso,
    departamento,
    loading,
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
    canAccessAgentesIA,
    canCreateIALigacao,
    canCreateEventos,
    canUploadBase,
    canDispararIALigacao,
    canDispararEventos,
    canManageEventos,
    canManageProspeccaoEquipes,
    canAprovarCampanhas,
    canValidarImportacao,
    canProgramarCampanhas,
    canGovernancaDados,
    canCreateUsers,
    // Permissões específicas
    canAddClientes,
    canAccessRecepcao,
    canReadQRCode,
    canManageUsers,
    canAccessAdminConfig,
    canAccessFinancialReports,
    canAccessKanban,
    canManageEvents,
    canImportClientes,
    canGenerateInvites,
    canCreateTemplates,
  };
}

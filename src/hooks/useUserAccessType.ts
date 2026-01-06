import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type TipoAcesso = Database["public"]["Enums"]["tipo_acesso"];

export function useUserAccessType() {
  const { user } = useAuth();
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTipoAcesso = async () => {
      if (!user) {
        setTipoAcesso(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("tipo_acesso")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar tipo de acesso:", error);
          setTipoAcesso(null);
        } else {
          setTipoAcesso(data?.tipo_acesso ?? null);
        }
      } catch (err) {
        console.error("Erro ao buscar tipo de acesso:", err);
        setTipoAcesso(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTipoAcesso();
  }, [user]);

  const isAdmin = tipoAcesso === "Administrador";
  const isTI = tipoAcesso === "TI";
  const isAdminOrTI = isAdmin || isTI;
  const isDiretor = tipoAcesso === "Diretor";
  const isGerente = tipoAcesso === "Gerente de Leads" || tipoAcesso === "Gerente de Loja";
  const isCRM = tipoAcesso === "CRM";
  const isRecepcionista = tipoAcesso === "Recepcionista";
  const isVendedor = tipoAcesso === "Vendedor";
  const isSDR = tipoAcesso === "SDR";
  const isProprietario = tipoAcesso === "Proprietário";

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
  
  // Permissões para adicionar clientes manualmente/importar: todos EXCETO Recepcionista
  const canImportClientes = !isRecepcionista;
  
  // Permissões para gerar convites/QR Codes: todos EXCETO Recepcionista
  const canGenerateInvites = !isRecepcionista;

  return {
    tipoAcesso,
    loading,
    isAdmin,
    isTI,
    isAdminOrTI,
    isDiretor,
    isGerente,
    isCRM,
    isRecepcionista,
    isVendedor,
    isSDR,
    isProprietario,
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
  };
}

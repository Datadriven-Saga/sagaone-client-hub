import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { toast } from "sonner";

export function useAutoAtribuirLeads() {
  const { user } = useAuth();
  const { isVendedor, isSDR, loading: accessLoading } = useUserAccessType();
  const [loading, setLoading] = useState(false);
  const [leadsPendentes, setLeadsPendentes] = useState<number | null>(null);

  // Verifica se o usuário é vendedor/SDR (perfis que têm limite de leads)
  const isLimitedUser = isVendedor || isSDR;

  // Conta quantos leads pendentes o vendedor tem
  const contarLeadsPendentes = useCallback(async () => {
    if (!user || !isLimitedUser) return null;

    try {
      const { data, error } = await supabase.rpc("count_vendedor_leads_pendentes");
      
      if (error) {
        console.error("Erro ao contar leads pendentes:", error);
        return null;
      }
      
      setLeadsPendentes(data);
      return data;
    } catch (err) {
      console.error("Erro ao contar leads pendentes:", err);
      return null;
    }
  }, [user, isLimitedUser]);

  // Verifica se precisa de mais leads
  const verificarPrecisaLeads = useCallback(async () => {
    if (!user || !isLimitedUser) return false;

    try {
      const { data, error } = await supabase.rpc("vendedor_precisa_leads");
      
      if (error) {
        console.error("Erro ao verificar necessidade de leads:", error);
        return false;
      }
      
      return data === true;
    } catch (err) {
      console.error("Erro ao verificar necessidade de leads:", err);
      return false;
    }
  }, [user, isLimitedUser]);

  // Atribui automaticamente leads ao vendedor
  const atribuirLeadsAutomaticamente = useCallback(async (showToast = true) => {
    if (!user || !isLimitedUser) return 0;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("auto_atribuir_leads_vendedor");
      
      if (error) {
        console.error("Erro ao atribuir leads:", error);
        if (showToast) {
          toast.error("Erro ao buscar novos leads");
        }
        return 0;
      }
      
      if (showToast && data > 0) {
        toast.success(`${data} novo(s) lead(s) atribuído(s) a você!`);
      }
      
      // Atualiza contagem
      await contarLeadsPendentes();
      
      return data || 0;
    } catch (err) {
      console.error("Erro ao atribuir leads:", err);
      if (showToast) {
        toast.error("Erro ao buscar novos leads");
      }
      return 0;
    } finally {
      setLoading(false);
    }
  }, [user, isLimitedUser, contarLeadsPendentes]);

  // Verifica e atribui leads se necessário (para chamar automaticamente)
  const verificarEAtribuirSeNecessario = useCallback(async () => {
    if (!user || !isLimitedUser || accessLoading) return;

    const precisaLeads = await verificarPrecisaLeads();
    
    if (precisaLeads) {
      await atribuirLeadsAutomaticamente(true);
    }
  }, [user, isLimitedUser, accessLoading, verificarPrecisaLeads, atribuirLeadsAutomaticamente]);

  return {
    isLimitedUser,
    loading,
    leadsPendentes,
    contarLeadsPendentes,
    verificarPrecisaLeads,
    atribuirLeadsAutomaticamente,
    verificarEAtribuirSeNecessario,
  };
}

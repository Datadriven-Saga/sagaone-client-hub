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
    if (!user || !isLimitedUser) {
      console.log('[AutoAtribuir] contarLeadsPendentes ignorado', {
        hasUser: !!user,
        isLimitedUser,
      });
      return null;
    }

    try {
      console.log('[AutoAtribuir] Contando leads pendentes...', {
        userId: user.id,
      });

      const { data, error } = await supabase.rpc("count_vendedor_leads_pendentes", {
        user_id_param: user.id,
      });
      
      console.log('[AutoAtribuir] count_vendedor_leads_pendentes retorno', { data, error });

      if (error) {
        console.error('[AutoAtribuir] Erro ao contar leads pendentes:', error);
        return null;
      }
      
      setLeadsPendentes(data);
      return data;
    } catch (err) {
      console.error('[AutoAtribuir] Erro ao contar leads pendentes:', err);
      return null;
    }
  }, [user, isLimitedUser]);

  // Verifica se precisa de mais leads
  const verificarPrecisaLeads = useCallback(async () => {
    if (!user || !isLimitedUser) {
      console.log('[AutoAtribuir] verificarPrecisaLeads ignorado', {
        hasUser: !!user,
        isLimitedUser,
      });
      return false;
    }

    try {
      console.log('[AutoAtribuir] Verificando se usuário precisa de leads...', {
        userId: user.id,
      });

      const { data, error } = await supabase.rpc("vendedor_precisa_leads", {
        user_id_param: user.id,
      });
      
      console.log('[AutoAtribuir] vendedor_precisa_leads retorno', { data, error });

      if (error) {
        console.error('[AutoAtribuir] Erro ao verificar necessidade de leads:', error);
        return false;
      }
      
      return data === true;
    } catch (err) {
      console.error('[AutoAtribuir] Erro ao verificar necessidade de leads:', err);
      return false;
    }
  }, [user, isLimitedUser]);

  // Atribui automaticamente leads ao vendedor
  const atribuirLeadsAutomaticamente = useCallback(async (showToast = true) => {
    if (!user || !isLimitedUser) {
      console.log('[AutoAtribuir] atribuirLeadsAutomaticamente ignorado', {
        hasUser: !!user,
        isLimitedUser,
      });
      return 0;
    }

    setLoading(true);
    try {
      console.log('[AutoAtribuir] Iniciando atribuição automática...', {
        userId: user.id,
        showToast,
      });

      const leadsAntes = await contarLeadsPendentes();
      const precisaAntes = await verificarPrecisaLeads();

      console.log('[AutoAtribuir] Estado antes da RPC', {
        userId: user.id,
        leadsAntes,
        precisaAntes,
      });

      const { data, error } = await supabase.rpc("auto_atribuir_leads_vendedor", {
        user_id_param: user.id,
      });
      
      console.log('[AutoAtribuir] auto_atribuir_leads_vendedor retorno', { data, error });
      
      if (error) {
        console.error('[AutoAtribuir] Erro ao atribuir leads:', error);
        if (showToast) {
          toast.error(`Erro ao buscar novos leads: ${error.message}`);
        }
        return 0;
      }

      const leadsDepois = await contarLeadsPendentes();

      console.log('[AutoAtribuir] Estado após RPC', {
        userId: user.id,
        leadsAntes,
        leadsDepois,
        atribuídos: data,
      });
      
      if (showToast) {
        if (data > 0) {
          toast.success(`${data} novo(s) lead(s) atribuído(s) a você!`);
        } else {
          toast.info("Nenhum lead novo disponível no momento. Tente novamente mais tarde.");
        }
      }
      
      return data || 0;
    } catch (err) {
      console.error('[AutoAtribuir] Erro ao atribuir leads:', err);
      if (showToast) {
        toast.error("Erro ao buscar novos leads");
      }
      return 0;
    } finally {
      setLoading(false);
    }
  }, [user, isLimitedUser, contarLeadsPendentes, verificarPrecisaLeads]);

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

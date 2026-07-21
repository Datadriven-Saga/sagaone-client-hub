import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { toast } from "sonner";

interface AutoAtribuirDebugContext {
  source?: string;
  activeCompanyId?: string | null;
  prospeccaoIds?: string[];
  kanbanNovosCount?: number;
  kanbanNovosLoadedItems?: number;
  filters?: Record<string, unknown>;
}

type DebugAutoAtribuicaoSnapshot = {
  user?: Record<string, unknown>;
  limite?: {
    limite_total?: number;
    pendentes_rpc?: number;
    vagas_calculadas?: number;
  };
  filtro?: Record<string, unknown>;
  prospeccoes?: Array<Record<string, unknown>>;
  status_usuario_no_escopo?: Array<Record<string, unknown>>;
  novos_total_no_escopo?: number;
  elegiveis_pela_rpc_atual?: number;
  quantidade_esperada_se_rpc_usar_mesma_regra?: number;
  bloqueios?: Array<Record<string, unknown>>;
  amostras_elegiveis?: Array<Record<string, unknown>>;
  amostras_bloqueadas?: Array<Record<string, unknown>>;
  observacao?: string;
};

const LEAD_LIMIT = 30;

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
  const atribuirLeadsAutomaticamente = useCallback(async (
    showToast = true,
    debugContext?: AutoAtribuirDebugContext,
  ) => {
    if (!user || !isLimitedUser) {
      console.log('[AutoAtribuir] atribuirLeadsAutomaticamente ignorado', {
        hasUser: !!user,
        isLimitedUser,
      });
      return 0;
    }

    setLoading(true);
    try {
      const debugProspeccaoId = debugContext?.prospeccaoIds?.length === 1
        ? debugContext.prospeccaoIds[0]
        : null;

      const logDebugSnapshot = async (phase: 'antes' | 'depois') => {
        if (!debugProspeccaoId) {
          console.info(`[AutoAtribuir][Diagnóstico ${phase}] RPC de diagnóstico não chamada`, {
            motivo: 'É necessário exatamente 1 evento selecionado para diagnosticar a solicitação com segurança.',
            prospeccaoIds: debugContext?.prospeccaoIds,
          });
          return null;
        }

        const { data, error } = await (supabase as any).rpc('debug_auto_atribuicao_leads', {
          user_id_param: user.id,
          prospeccao_id_param: debugProspeccaoId,
        });

        const snapshot = data as DebugAutoAtribuicaoSnapshot | null;
        console.groupCollapsed(`[AutoAtribuir][Diagnóstico ${phase}] validação da solicitação`);
        console.log('Contexto da tela', debugContext);
        console.log('Evento diagnosticado', debugProspeccaoId);
        console.log('Erro da RPC de diagnóstico', error);
        console.log('Snapshot completo', snapshot);
        console.log('Resumo esperado', {
          pendentesRpc: snapshot?.limite?.pendentes_rpc,
          limite: snapshot?.limite?.limite_total ?? LEAD_LIMIT,
          vagasCalculadas: snapshot?.limite?.vagas_calculadas,
          novosNoEvento: snapshot?.novos_total_no_escopo,
          elegiveisPelaRpcAtual: snapshot?.elegiveis_pela_rpc_atual,
          quantidadeEsperada: snapshot?.quantidade_esperada_se_rpc_usar_mesma_regra,
        });
        if (snapshot?.status_usuario_no_escopo?.length) {
          console.table(snapshot.status_usuario_no_escopo);
        }
        if (snapshot?.bloqueios?.length) {
          console.table(snapshot.bloqueios);
        }
        if (snapshot?.prospeccoes?.length) {
          console.table(snapshot.prospeccoes);
        }
        if (snapshot?.amostras_elegiveis?.length) {
          console.table(snapshot.amostras_elegiveis);
        }
        if (snapshot?.amostras_bloqueadas?.length) {
          console.table(snapshot.amostras_bloqueadas);
        }
        console.groupEnd();

        if (error) {
          console.error(`[AutoAtribuir][Diagnóstico ${phase}] Erro ao consultar debug_auto_atribuicao_leads`, error);
        }

        return snapshot;
      };

      console.groupCollapsed('[AutoAtribuir] Fluxo completo de solicitação de leads');
      console.log('Solicitação iniciada', {
        userId: user.id,
        userEmail: user.email,
        userName: user.user_metadata?.nome_completo || user.user_metadata?.full_name,
        showToast,
        isLimitedUser,
        isVendedor,
        isSDR,
        debugContext,
      });

      const leadsAntes = await contarLeadsPendentes();
      const precisaAntes = await verificarPrecisaLeads();
      const diagnosticoAntes = await logDebugSnapshot('antes');

      console.log('[AutoAtribuir] Estado antes da RPC', {
        userId: user.id,
        leadsAntes,
        precisaAntes,
        diagnosticoAntesResumo: {
          atribuídosNoEscopo: diagnosticoAntes?.status_usuario_no_escopo?.find((row) => row.status === 'Atribuído')?.total,
          vagasCalculadas: diagnosticoAntes?.limite?.vagas_calculadas,
          novosNoEscopo: diagnosticoAntes?.novos_total_no_escopo,
          elegiveisPelaRpcAtual: diagnosticoAntes?.elegiveis_pela_rpc_atual,
          quantidadeEsperada: diagnosticoAntes?.quantidade_esperada_se_rpc_usar_mesma_regra,
        },
      });

      const requestPayload = { user_id_param: user.id };
      console.log('[AutoAtribuir] Chamando RPC auto_atribuir_leads_vendedor', requestPayload);
      const { data, error } = await supabase.rpc("auto_atribuir_leads_vendedor", {
        user_id_param: requestPayload.user_id_param,
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
      const diagnosticoDepois = await logDebugSnapshot('depois');

      console.log('[AutoAtribuir] Estado após RPC', {
        userId: user.id,
        leadsAntes,
        leadsDepois,
        atribuídos: data,
        validacao: {
          vagasAntes: diagnosticoAntes?.limite?.vagas_calculadas,
          elegiveisAntes: diagnosticoAntes?.elegiveis_pela_rpc_atual,
          esperadoAntes: diagnosticoAntes?.quantidade_esperada_se_rpc_usar_mesma_regra,
          retornadoPelaRpc: data,
          diferencaEsperadoVsRetornado: typeof diagnosticoAntes?.quantidade_esperada_se_rpc_usar_mesma_regra === 'number' && typeof data === 'number'
            ? diagnosticoAntes.quantidade_esperada_se_rpc_usar_mesma_regra - data
            : null,
          pendentesDepois: diagnosticoDepois?.limite?.pendentes_rpc,
          atribuídosDepoisNoEscopo: diagnosticoDepois?.status_usuario_no_escopo?.find((row) => row.status === 'Atribuído')?.total,
          novosDepoisNoEscopo: diagnosticoDepois?.novos_total_no_escopo,
          elegiveisDepois: diagnosticoDepois?.elegiveis_pela_rpc_atual,
        },
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
      console.groupEnd();
      setLoading(false);
    }
  }, [user, isLimitedUser, isVendedor, isSDR, contarLeadsPendentes, verificarPrecisaLeads]);

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

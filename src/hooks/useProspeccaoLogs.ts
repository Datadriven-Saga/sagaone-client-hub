import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface LogMovimentacao {
  leadId: string;
  prospeccaoId: string;
  statusAnterior?: string;
  statusNovo: string;
  usuarioId?: string;
  observacoes?: string;
}

export const useProspeccaoLogs = () => {
  const { toast } = useToast();

  const registrarMovimentacao = async (params: LogMovimentacao) => {
    try {
      const { error } = await supabase
        .from('logs_movimentacao_leads')
        .insert({
          lead_id: params.leadId,
          prospeccao_id: params.prospeccaoId,
          status_anterior: params.statusAnterior,
          status_novo: params.statusNovo,
          usuario_id: params.usuarioId,
          observacoes: params.observacoes,
        });

      if (error) {
        console.error('Erro ao registrar movimentação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível registrar a movimentação",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a movimentação",
        variant: "destructive",
      });
      return false;
    }
  };

  const obterLogsLead = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('logs_movimentacao_leads')
        .select('*')
        .eq('lead_id', leadId)
        .order('data_movimentacao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      return [];
    }
  };

  const obterLogsProspeccao = async (prospeccaoId: string) => {
    try {
      const { data, error } = await supabase
        .from('logs_movimentacao_leads')
        .select('*')
        .eq('prospeccao_id', prospeccaoId)
        .order('data_movimentacao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar logs da prospecção:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs da prospecção:', error);
      return [];
    }
  };

  return {
    registrarMovimentacao,
    obterLogsLead,
    obterLogsProspeccao,
  };
};
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export function useDashboardData() {
  const { activeCompany } = useCompany();
  const [data, setData] = useState({
    totalClientes: 0,
    clientesComTelefone: 0,
    notificacoesPendentes: 0,
    notificacoesRealizadas: 0,
    prospeccoesAtivas: 0,
    prospeccoesConfirmadas: 0,
    leadsAbertos: 0,
    leadsEmAndamento: 0,
    vendasMes: 0,
    vendasEmNegociacao: 0,
    eventosAtivos: 0,
    eventosConcluidos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany?.id) {
      setLoading(false);
      return;
    }

    async function fetchDashboardData() {
      try {
        const [
          clientesResult,
          notificacoesResult,
          prospeccoesResult,
          contatosResult,
          vendasResult,
          eventosResult
        ] = await Promise.all([
          // Clientes
          supabase
            .from('clientes')
            .select('id, telefone')
            .eq('empresa_id', activeCompany.id),
          
          // Notificações
          supabase
            .from('notificacoes')
            .select('id, status')
            .eq('destinatario_id', (await supabase.auth.getUser()).data.user?.id),
          
          // Prospecções
          supabase
            .from('prospeccoes')
            .select('id, leads_gerados, meta_leads')
            .eq('empresa_id', activeCompany.id),
          
          // Contatos (leads)
          supabase
            .from('contatos')
            .select('id, status')
            .eq('empresa_id', activeCompany.id),
          
          // Vendas do mês atual - removido pois tabela vendas não existe mais
          Promise.resolve({ data: [] }),
          
          // Eventos de prospecção
          supabase
            .from('eventos_prospeccao')
            .select('id, prospeccao_id, data_evento, resultado')
            .in('prospeccao_id', (await supabase.from('prospeccoes').select('id').eq('empresa_id', activeCompany.id)).data?.map(p => p.id) || [])
        ]);

        const clientes = clientesResult.data || [];
        const notificacoes = notificacoesResult.data || [];
        const prospeccoes = prospeccoesResult.data || [];
        const contatos = contatosResult.data || [];
        const vendas = vendasResult.data || [];
        const eventos = eventosResult.data || [];

        setData({
          totalClientes: clientes.length,
          clientesComTelefone: clientes.filter(c => c.telefone).length,
          notificacoesPendentes: notificacoes.filter(n => n.status === 'Pendente').length,
          notificacoesRealizadas: notificacoes.filter(n => n.status === 'Lida').length,
          prospeccoesAtivas: prospeccoes.length,
          prospeccoesConfirmadas: prospeccoes.reduce((sum, p) => sum + (p.leads_gerados || 0), 0),
          leadsAbertos: contatos.filter(c => c.status === 'Novo').length,
          leadsEmAndamento: contatos.filter(c => c.status === 'Em Contato').length,
          vendasMes: vendas.length,
          vendasEmNegociacao: contatos.filter(c => c.status === 'Negociação').length,
          eventosAtivos: eventos.filter(e => !e.resultado).length,
          eventosConcluidos: eventos.filter(e => e.resultado).length
        });

      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [activeCompany?.id]);

  return { data, loading };
}
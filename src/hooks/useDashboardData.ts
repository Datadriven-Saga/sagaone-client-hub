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
    eventosConcluidos: 0,
    agentesAtivos: 0,
    automacoes: 0,
    relatoriosHoje: 0,
    relatoriosPendentes: 0,
    treinamentosAtivos: 0,
    progressoMedio: 0
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
          eventosResult,
          agentesResult,
          followupsResult,
          relatoriosResult,
          treinamentosResult,
          participacoesResult
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
            .in('prospeccao_id', (await supabase.from('prospeccoes').select('id').eq('empresa_id', activeCompany.id)).data?.map(p => p.id) || []),
          
          // Agentes IA (via agente_empresas, same logic as AgentesIA page)
          supabase
            .from('agente_empresas')
            .select(`
              agente_id,
              agentes_ia (
                id,
                telefone,
                ativo
              )
            `)
            .eq('empresa_id', activeCompany.id),
          
          // Follow-ups/Automações
          supabase
            .from('agente_followups')
            .select('id, ativo')
            .eq('empresa_id', activeCompany.id),
          
          // Relatórios
          supabase
            .from('relatorios')
            .select('id, data_geracao')
            .eq('empresa_id', activeCompany.id),
          
          // Treinamentos
          supabase
            .from('treinamentos')
            .select('id, ativo')
            .eq('empresa_id', activeCompany.id),
          
          // Participações em treinamentos
          supabase
            .from('participacoes_treinamento')
            .select('id, progresso, participante_id')
            .in('treinamento_id', (await supabase.from('treinamentos').select('id').eq('empresa_id', activeCompany.id)).data?.map(t => t.id) || [])
        ]);

        const clientes = clientesResult.data || [];
        const notificacoes = notificacoesResult.data || [];
        const prospeccoes = prospeccoesResult.data || [];
        const contatos = contatosResult.data || [];
        const vendas = vendasResult.data || [];
        const eventos = eventosResult.data || [];
        // Extract unique webhook agents (same filter as AgentesIA page)
        const agentesRaw = agentesResult.data || [];
        const uniqueAgentIds = new Set<string>();
        const uniquePhones = new Set<string>();
        const agentes: { id: string; ativo: boolean }[] = [];
        
        for (const item of agentesRaw) {
          const agente = (item as any).agentes_ia;
          if (!agente || uniqueAgentIds.has(agente.id)) continue;
          
          // Same isWebhookAgent filter: must have 10+ digit phone, no parenthesis prefix
          const tel = agente.telefone || '';
          if (tel.startsWith('(')) continue;
          const digits = tel.replace(/\D/g, '');
          if (digits.length < 10) continue;
          if (uniquePhones.has(digits)) continue;
          
          uniqueAgentIds.add(agente.id);
          uniquePhones.add(digits);
          agentes.push({ id: agente.id, ativo: agente.ativo });
        }
        const followups = followupsResult.data || [];
        const relatorios = relatoriosResult.data || [];
        const treinamentos = treinamentosResult.data || [];
        const participacoes = participacoesResult.data || [];

        // Calcular relatórios de hoje
        const hoje = new Date();
        const inicioDoDay = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const relatoriosHoje = relatorios.filter(r => 
          r.data_geracao && new Date(r.data_geracao) >= inicioDoDay
        ).length;

        // Calcular progresso médio dos treinamentos
        const progressoTotal = participacoes.reduce((sum, p) => sum + (p.progresso || 0), 0);
        const progressoMedio = participacoes.length > 0 ? Math.round(progressoTotal / participacoes.length) : 0;

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
          eventosConcluidos: eventos.filter(e => e.resultado).length,
          agentesAtivos: agentes.filter(a => a.ativo).length,
          automacoes: followups.filter(f => f.ativo).length,
          relatoriosHoje: relatoriosHoje,
          relatoriosPendentes: relatorios.length - relatoriosHoje,
          treinamentosAtivos: treinamentos.filter(t => t.ativo).length,
          progressoMedio: progressoMedio
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
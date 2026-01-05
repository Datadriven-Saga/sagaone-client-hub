import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone } from '@/lib/utils';

export interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Novo' | 'Em Contato' | 'Qualificado' | 'Proposta' | 'Negociação' | 'Fechado' | 'Perdido' | 'Atribuído' | 'Convidado' | 'Agendado' | 'Confirmado' | 'Check-in' | 'Venda' | 'Descartado' | 'Desperdício' | 'Em Espera' | 'Opt Out';
  valor_potencial?: number;
  responsavel_email?: string;
  cliente_id?: string;
  empresa_id?: string;
  observacoes?: string;
  origem: 'Site' | 'WhatsApp' | 'Instagram' | 'Facebook' | 'Google' | 'Indicação' | 'Telefone' | 'Email' | 'Outros';
  created_at: string;
  updated_at: string;
}

// Mapeamento dos status do banco para as colunas do Kanban
export const statusKanbanMap = {
  'Novo': 'novos',
  'Atribuído': 'atribuidos',
  'Em Espera': 'emespera',
  'Convidado': 'convidados',
  'Agendado': 'agendados',
  'Confirmado': 'confirmados',
  'Check-in': 'checkin',
  'Venda': 'venda',
  'Descartado': 'descartados',
  'Opt Out': 'optout',
  'Desperdício': 'desperdicio',
  'Negociação': 'enviados', 
  'Em Contato': 'recebidos',
  'Qualificado': 'qualificados',
  'Fechado': 'fechados',
  'Perdido': 'cancelados'
} as const;

export const kanbanStatusMap = {
  'novos': 'Novo',
  'atribuidos': 'Atribuído',
  'emespera': 'Em Espera',
  'convidados': 'Convidado',
  'agendados': 'Agendado',
  'confirmados': 'Confirmado',
  'checkin': 'Check-in',
  'venda': 'Venda',
  'descartados': 'Descartado',
  'optout': 'Opt Out',
  'desperdicio': 'Desperdício',
  'enviados': 'Negociação',
  'recebidos': 'Em Contato', 
  'qualificados': 'Qualificado',
  'fechados': 'Fechado',
  'cancelados': 'Perdido'
} as const;

export interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
  meta_leads?: number;
  meta_novos?: number;
  meta_seminovos?: number;
  meta_diretas?: number;
  meta_checkins?: number;
  meta_confirmacoes?: number;
  meta_convites?: number;
  leads_gerados: number;
  responsavel_id?: string;
  empresa_id?: string;
  canal: 'Whatsapp' | 'Ligação';
  persona_id?: string;
  created_at: string;
  updated_at: string;
  // Premiações
  premio_equipe_campea?: number;
  premio_equipe_2lugar?: number;
  premio_equipe_3lugar?: number;
  premio_vendedor_ouro?: number;
  premio_vendedor_prata?: number;
  premio_vendedor_bronze?: number;
  premio_prospector_ouro?: number;
  premio_prospector_prata?: number;
  premio_prospector_bronze?: number;
  premio_checkin_ouro?: number;
  premio_checkin_prata?: number;
  premio_checkin_bronze?: number;
  premio_participacao_apoio?: number;
  premio_indicacao_venda?: number;
}

export const useContatoData = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  console.log('🏢 useContatoData - activeCompany:', activeCompany);
  console.log('👤 useContatoData - user:', user);

  // Buscar prospecções com filtro de empresa
  const fetchProspeccoes = useCallback(async () => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for prospeccoes');
      setProspeccoes([]);
      return;
    }

    try {
      console.log('🔍 Fetching prospeccoes for company:', activeCompany.id);
      
      const { data, error } = await supabase
        .from('prospeccoes')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching prospeccoes:', error);
        throw error;
      }
      
      console.log('📊 Prospeccoes fetched:', data?.length || 0);
      setProspeccoes((data || []).map(p => ({
        ...p,
        canal: (p.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
      })));
    } catch (error) {
      console.error('Erro ao buscar prospecções:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar prospecções: " + (error as Error).message,
        variant: "destructive"
      });
      setProspeccoes([]);
    }
  }, [activeCompany?.id, toast]);

  // Buscar contatos com filtro de empresa
  const fetchContatos = useCallback(async () => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for contatos');
      setContatos([]);
      return;
    }

    try {
      console.log('🔍 Fetching contatos for company:', activeCompany.id);
      
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contatos:', error);
        throw error;
      }
      
      console.log('📞 Contatos fetched:', data?.length || 0);
      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro", 
        description: "Erro ao carregar contatos: " + (error as Error).message,
        variant: "destructive"
      });
      setContatos([]);
    }
  }, [activeCompany?.id, toast]);

  // Carregamento de dados quando empresa ativa muda  
  useEffect(() => {
    console.log('🔄 useContatoData useEffect triggered');
    console.log('👤 User ID:', user?.id);
    console.log('🏢 Active company ID:', activeCompany?.id);

    if (!user?.id) {
      console.log('❌ User not authenticated, clearing data');
      setContatos([]);
      setProspeccoes([]);
      setLoading(false);
      return;
    }

    // Se não tem empresa ativa mas o usuário está autenticado, aguardar um pouco
    if (!activeCompany?.id) {
      console.log('⏳ No active company yet, waiting...');
      setContatos([]);
      setProspeccoes([]);
      
      // Timeout para evitar loading infinito - após 3 segundos para de carregar
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout reached, stopping loading without active company');
        setLoading(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }

    const loadData = async () => {
      console.log('🔄 Loading data for company:', activeCompany.id);
      setLoading(true);
      
      try {
        await Promise.all([
          fetchProspeccoes(),
          fetchContatos()
        ]);
        console.log('✅ Data loaded successfully');
      } catch (error) {
        console.error('❌ Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCompany?.id, user?.id]); // FIXED: usar user?.id em vez de user objeto

  // Adicionar novos contatos com empresa_id automático
  const adicionarContatos = async (novosContatos: {
    nome: string;
    telefone: string;
    email?: string;
    origem: Contato['origem'];
    observacoes?: string;
    responsavel_email?: string;
  }[], prospeccaoId?: string) => {
    if (!activeCompany?.id) {
      toast({ 
        title: "Erro", 
        description: "Empresa não selecionada", 
        variant: "destructive" 
      });
      return;
    }

    console.log('🚀 adicionarContatos chamada com:', { novosContatos: novosContatos.length, prospeccaoId });

    try {
      const contatosComEmpresa = novosContatos.map(contato => ({
        ...contato,
        status: 'Novo' as const,
        empresa_id: activeCompany.id
      }));

      console.log('➕ Adding contatos:', contatosComEmpresa);

      const { data, error } = await supabase
        .from('contatos')
        .insert(contatosComEmpresa)
        .select();

      if (error) {
        console.error('Error adding contatos:', error);
        throw error;
      }
      
      console.log('✅ Contatos added successfully:', data?.length);
      console.log('🔗 Prospeccao ID for webhook:', prospeccaoId);
      
      // Disparar webhooks para cada contato inserido se prospeccaoId foi fornecido
      if (data && prospeccaoId) {
        console.log('🚀 Iniciando disparo de webhooks para', data.length, 'contatos');
        
        // Buscar dados da prospecção para incluir no webhook
        const { data: prospeccaoData } = await supabase
          .from('prospeccoes')
          .select('id, titulo, data_inicio, data_fim, canal')
          .eq('id', prospeccaoId)
          .single();
        
        console.log('📊 Dados da prospecção para webhook:', prospeccaoData);
        
        for (const contato of data) {
          try {
            console.log('Disparando webhook para contato:', contato);
            
            // Webhook de prospecção (existente)
            const webhookResponse = await supabase.functions.invoke('trigger-webhook', {
              body: {
                gatilho: 'novo_contato_prospeccao',
                dados: {
                  contato_id: contato.id,
                  prospeccao_id: prospeccaoId,
                  nome: contato.nome,
                  telefone: normalizePhone(contato.telefone),
                  email: contato.email,
                  status: contato.status || 'Novo',
                  // Dados da prospecção
                  prospeccao: {
                    id: prospeccaoData?.id,
                    nome: prospeccaoData?.titulo,
                    data_inicio: prospeccaoData?.data_inicio,
                    data_fim: prospeccaoData?.data_fim
                  }
                }
              }
            });
            
            console.log('Webhook prospecção response:', webhookResponse);
            
            // Webhook de status para atendimento - APENAS para campanhas WhatsApp
            if (prospeccaoData?.canal === 'Whatsapp') {
              await supabase.functions.invoke('atendimento-status-webhook', {
                body: {
                  telefone_lead: normalizePhone(contato.telefone),
                  status: contato.status || 'Novo',
                  empresa_id: activeCompany.id,
                  evento: 'criacao',
                  leadId: contato.lead_id
                }
              });
              console.log('✅ Webhook atendimento-status disparado (campanha WhatsApp) com leadId:', contato.lead_id);
            }
            
            console.log('Webhooks disparados com sucesso para contato:', contato.id);
          } catch (webhookError) {
            console.error('Erro ao disparar webhook para contato:', contato.id, webhookError);
          }
        }
      }
      // Leads sem prospecção NÃO disparam webhook de status
      
      if (data) setContatos(prev => [...data, ...prev]);
      
      toast({ 
        title: "Sucesso", 
        description: `${data?.length || 0} contatos adicionados com sucesso` 
      });
      
      return data;
    } catch (error) {
      console.error('Erro ao adicionar contatos:', error);
      toast({ 
        title: "Erro", 
        description: "Erro ao adicionar contatos: " + (error as Error).message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  // Dispara webhook de status para atendimento - APENAS para leads de campanhas WhatsApp
  const dispararWebhookStatusAtendimento = async (contatoId: string, telefone: string, status: string, evento: 'criacao' | 'mudanca_status', leadId?: number) => {
    if (!activeCompany?.id) return;
    
    try {
      // Verificar se o contato pertence a uma prospecção WhatsApp via eventos_prospeccao
      const { data: vinculo } = await supabase
        .from('eventos_prospeccao')
        .select('prospeccao_id')
        .eq('contato_id', contatoId)
        .limit(1)
        .maybeSingle();
      
      if (!vinculo?.prospeccao_id) {
        console.log('⏭️ Contato não pertence a nenhuma prospecção, webhook não disparado');
        return;
      }
      
      // Verificar se a prospecção é do tipo WhatsApp
      const { data: prospeccao } = await supabase
        .from('prospeccoes')
        .select('canal')
        .eq('id', vinculo.prospeccao_id)
        .single();
      
      if (prospeccao?.canal !== 'Whatsapp') {
        console.log('⏭️ Prospecção não é WhatsApp, webhook não disparado');
        return;
      }
      
      // Buscar lead_id se não foi passado
      let finalLeadId = leadId;
      if (!finalLeadId) {
        const { data: contatoData } = await supabase
          .from('contatos')
          .select('lead_id')
          .eq('id', contatoId)
          .single();
        finalLeadId = contatoData?.lead_id;
      }
      
      console.log('🔔 Disparando webhook de status atendimento (campanha WhatsApp):', { telefone, status, evento, leadId: finalLeadId });
      
      const { data, error } = await supabase.functions.invoke('atendimento-status-webhook', {
        body: {
          telefone_lead: normalizePhone(telefone),
          status: status,
          empresa_id: activeCompany.id,
          evento: evento,
          leadId: finalLeadId
        }
      });
      
      if (error) {
        console.error('Erro ao disparar webhook de status:', error);
      } else {
        console.log('✅ Webhook de status disparado com sucesso:', data);
      }
    } catch (error) {
      console.error('Erro ao disparar webhook de status:', error);
    }
  };

  // Atualizar status - COM WEBHOOK (apenas para campanhas WhatsApp)
  const atualizarStatusContato = async (contatoId: string, novoStatus: Contato['status']) => {
    try {
      // Buscar contato atual para pegar o telefone
      const contatoAtual = contatos.find(c => c.id === contatoId);
      
      const { error } = await supabase
        .from('contatos')
        .update({ status: novoStatus })
        .eq('id', contatoId);

      if (error) throw error;
      
      setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, status: novoStatus } : c));
      
      // Disparar webhook de status - a função verifica internamente se é campanha WhatsApp
      if (contatoAtual?.telefone) {
        dispararWebhookStatusAtendimento(contatoId, contatoAtual.telefone, novoStatus, 'mudanca_status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Excluir contato - SIMPLES
  const excluirContato = async (contatoId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.filter(c => c.id !== contatoId));
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
    }
  };

  // Atribuir responsável - SIMPLES  
  const atribuirResponsavel = async (contatoId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .update({ responsavel_email: userId })
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, responsavel_email: userId } : c));
    } catch (error) {
      console.error('Erro ao atribuir responsável:', error);
    }
  };

  // Criar prospecção com empresa_id automático
  const criarProspeccao = async (dadosProspeccao: Omit<Prospeccao, 'id' | 'created_at' | 'updated_at' | 'leads_gerados'>) => {
    if (!activeCompany?.id) {
      console.error('❌ No active company available:', activeCompany);
      throw new Error('Empresa não selecionada');
    }

    try {
      const prospeccaoComEmpresa = {
        ...dadosProspeccao,
        leads_gerados: 0,
        empresa_id: activeCompany.id
      };

      console.log('➕ Creating prospeccao with active company:', activeCompany.id);
      console.log('➕ Prospeccao data:', prospeccaoComEmpresa);

      const { data, error } = await supabase
        .from('prospeccoes')
        .insert(prospeccaoComEmpresa)
        .select()
        .single();

      if (error) {
        console.error('Error creating prospeccao:', error);
        throw error;
      }
      
      if (data) {
        const prospeccaoFormatada = {
          ...data,
          canal: (data.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
        };
        console.log('✅ Prospeccao created successfully:', prospeccaoFormatada);
        setProspeccoes(prev => [prospeccaoFormatada, ...prev]);
        toast({ 
          title: "Sucesso", 
          description: "Prospecção criada com sucesso" 
        });
        return prospeccaoFormatada;
      }
    } catch (error) {
      console.error('Erro ao criar prospecção:', error);
      toast({ 
        title: "Erro", 
        description: "Erro ao criar prospecção: " + (error as Error).message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  // Editar prospecção - SIMPLES
  const editarProspeccao = async (prospeccaoId: string, dadosAtualizados: Partial<Prospeccao>) => {
    try {
      const { data, error } = await supabase
        .from('prospeccoes')
        .update(dadosAtualizados)
        .eq('id', prospeccaoId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const prospeccaoFormatada = {
          ...data,
          canal: (data.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
        };
        setProspeccoes(prev => prev.map(p => p.id === prospeccaoId ? prospeccaoFormatada : p));
      }
    } catch (error) {
      console.error('Erro ao editar prospecção:', error);
      throw error;
    }
  };

  // Excluir prospecção - SIMPLES
  const excluirProspeccao = async (prospeccaoId: string) => {
    try {
      const { error } = await supabase
        .from('prospeccoes')
        .delete()
        .eq('id', prospeccaoId);

      if (error) throw error;
      setProspeccoes(prev => prev.filter(p => p.id !== prospeccaoId));
    } catch (error) {
      console.error('Erro ao excluir prospecção:', error);
      throw error;
    }
  };

  // Métricas - Corrigido com status corretos
  const getMetricas = () => {
    const totalBase = contatos.length;
    const novos = contatos.filter(c => c.status === 'Novo').length;
    const atribuidos = contatos.filter(c => c.status === 'Atribuído').length;
    const emEspera = contatos.filter(c => c.status === 'Em Espera').length;
    const convidados = contatos.filter(c => c.status === 'Convidado').length;
    const agendados = contatos.filter(c => c.status === 'Agendado').length;
    const confirmados = contatos.filter(c => c.status === 'Confirmado').length;
    const checkin = contatos.filter(c => c.status === 'Check-in').length;
    const vendas = contatos.filter(c => c.status === 'Venda').length;
    const descartados = contatos.filter(c => c.status === 'Descartado').length;
    const optOut = contatos.filter(c => c.status === 'Opt Out').length;
    const desperdicio = contatos.filter(c => c.status === 'Desperdício').length;
    
    // Disponíveis = Total - Atribuídos (que já foram distribuídos a alguém)
    const disponiveisDistribuicao = totalBase - atribuidos - emEspera - convidados - agendados - confirmados - checkin - vendas - descartados - optOut;

    return {
      totalBase,
      novos,
      atribuidos,
      emEspera,
      convidados,
      agendados,
      confirmados,
      checkin,
      vendas,
      descartados,
      optOut,
      desperdicio,
      disponiveisDistribuicao
    };
  };

  const updateDateFilter = (start: string, end: string) => {
    setDateFilter({ start, end });
  };

  return {
    contatos,
    prospeccoes,
    loading,
    adicionarContatos,
    atualizarStatusContato,
    excluirContato,
    atribuirResponsavel,
    getMetricas,
    updateDateFilter,
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    refetch: () => {
      fetchProspeccoes();
      fetchContatos();
    }
  };
};
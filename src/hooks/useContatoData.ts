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
  event_id_pri?: string;
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

  // Buscar contatos com filtro de empresa - SEM LIMITE (paginação automática)
  const fetchContatos = useCallback(async () => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for contatos');
      setContatos([]);
      return;
    }

    try {
      console.log('🔍 Fetching ALL contatos for company:', activeCompany.id);
      
      const PAGE_SIZE = 1000;
      let allContatos: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('contatos')
          .select('*')
          .eq('empresa_id', activeCompany.id)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
          console.error('Error fetching contatos page:', page, error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allContatos = [...allContatos, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
          console.log(`📥 Página ${page} carregada: ${data.length} contatos (total: ${allContatos.length})`);
        } else {
          hasMore = false;
        }
      }
      
      console.log('📞 Total contatos fetched:', allContatos.length);
      setContatos(allContatos);
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

  // Normalizar telefone para comparação (remove caracteres especiais)
  const normalizeTelefoneForComparison = (telefone: string): string => {
    return telefone.replace(/\D/g, '').slice(-9); // Últimos 9 dígitos
  };

  // Adicionar novos contatos com empresa_id automático e prevenção de duplicados
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
      // Se tem prospeccaoId, verificar duplicados apenas para esta prospecção
      // Caso contrário, verificar duplicados globais na empresa
      let telefonesExistentes = new Set<string>();
      let emailsExistentes = new Set<string>();

      // Helper para buscar todos os registros sem limite (paginação automática)
      const fetchAllContatos = async (empresaId: string): Promise<{ telefone: string | null; email: string | null }[]> => {
        const PAGE_SIZE = 1000;
        let allData: { telefone: string | null; email: string | null }[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('contatos')
            .select('telefone, email')
            .eq('empresa_id', empresaId)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          
          if (error) {
            console.error('Erro na paginação:', error);
            break;
          }
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }
        
        return allData;
      };

      const fetchAllEventos = async (prospeccaoId: string): Promise<{ contato_id: string | null }[]> => {
        const PAGE_SIZE = 1000;
        let allData: { contato_id: string | null }[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('eventos_prospeccao')
            .select('contato_id')
            .eq('prospeccao_id', prospeccaoId)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          
          if (error) {
            console.error('Erro na paginação eventos:', error);
            break;
          }
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }
        
        return allData;
      };
      
      if (prospeccaoId) {
        // Buscar contatos JÁ vinculados a esta prospecção específica via eventos_prospeccao
        const eventosProspeccao = await fetchAllEventos(prospeccaoId);
        
        const contatoIdsNaProspeccao = eventosProspeccao.map(e => e.contato_id).filter(Boolean) as string[];
        
        if (contatoIdsNaProspeccao.length > 0) {
          // Buscar telefones em lotes (limite de IN é ~32000 itens, mas usamos 500 para segurança)
          const IN_BATCH_SIZE = 500;
          const contatosNaProspeccao: { telefone: string | null; email: string | null }[] = [];
          
          for (let i = 0; i < contatoIdsNaProspeccao.length; i += IN_BATCH_SIZE) {
            const batchIds = contatoIdsNaProspeccao.slice(i, i + IN_BATCH_SIZE);
            const { data: batchData } = await supabase
              .from('contatos')
              .select('telefone, email')
              .in('id', batchIds);
            
            if (batchData) {
              contatosNaProspeccao.push(...batchData);
            }
          }
          
          telefonesExistentes = new Set(
            contatosNaProspeccao
              .filter(c => c.telefone)
              .map(c => normalizeTelefoneForComparison(c.telefone!))
          );
          emailsExistentes = new Set(
            contatosNaProspeccao
              .filter(c => c.email)
              .map(c => c.email!.toLowerCase())
          );
        }
        
        console.log(`📊 Verificando duplicados para prospecção ${prospeccaoId}:`, {
          contatosExistentes: contatoIdsNaProspeccao.length,
          telefonesUnicos: telefonesExistentes.size
        });
      } else {
        // Verificar duplicados globais na empresa - SEM LIMITE (paginação)
        const contatosExistentes = await fetchAllContatos(activeCompany.id);
        
        console.log(`📊 Total de contatos existentes na empresa: ${contatosExistentes.length}`);
        
        telefonesExistentes = new Set(
          contatosExistentes
            .filter(c => c.telefone)
            .map(c => normalizeTelefoneForComparison(c.telefone!))
        );
        emailsExistentes = new Set(
          contatosExistentes
            .filter(c => c.email)
            .map(c => c.email!.toLowerCase())
        );
      }
      
      // Filtrar contatos que já existem (por telefone)
      const contatosUnicos: typeof novosContatos = [];
      const duplicados: string[] = [];
      
      for (const contato of novosContatos) {
        const telNormalizado = normalizeTelefoneForComparison(contato.telefone);
        
        // Verificar duplicado apenas por telefone para evitar múltiplos leads com mesmo número no mesmo evento
        const duplicadoPorTel = telefonesExistentes.has(telNormalizado);
        
        if (duplicadoPorTel) {
          duplicados.push(contato.nome);
        } else {
          contatosUnicos.push(contato);
          // Adicionar aos sets para evitar duplicatas dentro do próprio lote
          telefonesExistentes.add(telNormalizado);
        }
      }
      
      if (duplicados.length > 0) {
        console.log('⚠️ Contatos duplicados ignorados (mesmo telefone no evento):', duplicados.length, duplicados);
      }
      
      if (contatosUnicos.length === 0) {
        const mensagemDuplicados = prospeccaoId 
          ? `Todos os ${novosContatos.length} contatos já existem neste evento.`
          : `Todos os ${novosContatos.length} contatos já existem no sistema.`;
        toast({ 
          title: "Atenção", 
          description: mensagemDuplicados,
          variant: "destructive"
        });
        return [];
      }

      const contatosComEmpresa = contatosUnicos.map(contato => ({
        ...contato,
        status: 'Novo' as const,
        empresa_id: activeCompany.id
      }));

      console.log('➕ Adding contatos:', contatosComEmpresa.length, '(', duplicados.length, 'duplicados ignorados)');

      // Inserir em lotes de 500 para evitar timeout/limite do Supabase
      const INSERT_BATCH_SIZE = 500;
      const insertBatches: typeof contatosComEmpresa[] = [];
      
      for (let i = 0; i < contatosComEmpresa.length; i += INSERT_BATCH_SIZE) {
        insertBatches.push(contatosComEmpresa.slice(i, i + INSERT_BATCH_SIZE));
      }

      console.log(`📦 Inserindo ${contatosComEmpresa.length} contatos em ${insertBatches.length} lotes de até ${INSERT_BATCH_SIZE}`);

      let allInsertedData: any[] = [];
      let insertErrors = 0;

      for (let i = 0; i < insertBatches.length; i++) {
        const batch = insertBatches[i];
        console.log(`📥 Inserindo lote ${i + 1}/${insertBatches.length} (${batch.length} contatos)`);
        
        const { data: batchData, error: batchError } = await supabase
          .from('contatos')
          .insert(batch)
          .select();

        if (batchError) {
          console.error(`❌ Erro no lote ${i + 1}:`, batchError);
          insertErrors += batch.length;
        } else if (batchData) {
          allInsertedData = [...allInsertedData, ...batchData];
          console.log(`✅ Lote ${i + 1} inserido: ${batchData.length} contatos`);
        }
      }

      const data = allInsertedData;
      
      if (insertErrors > 0 && data.length === 0) {
        throw new Error(`Falha ao inserir contatos: ${insertErrors} erros`);
      }
      
      if (insertErrors > 0) {
        toast({
          title: "Atenção",
          description: `${data.length} contatos inseridos, ${insertErrors} falharam`,
          variant: "destructive"
        });
      }
      
      console.log('✅ Contatos added successfully:', data?.length);
      console.log('🔗 Prospeccao ID for webhook:', prospeccaoId);
      
      // Vincular contatos à prospecção na tabela eventos_prospeccao
      if (data && data.length > 0 && prospeccaoId) {
        console.log('🔗 Vinculando contatos à prospecção:', prospeccaoId);
        
        const eventosParaInserir = data.map((contato: any) => ({
          contato_id: contato.id,
          prospeccao_id: prospeccaoId
        }));
        
        // Inserir em lotes para evitar timeout
        const EVENTO_BATCH_SIZE = 500;
        let eventosInseridos = 0;
        
        for (let i = 0; i < eventosParaInserir.length; i += EVENTO_BATCH_SIZE) {
          const batch = eventosParaInserir.slice(i, i + EVENTO_BATCH_SIZE);
          const { error: eventoError } = await supabase
            .from('eventos_prospeccao')
            .insert(batch);
          
          if (eventoError) {
            console.error('Erro ao vincular contatos à prospecção:', eventoError);
          } else {
            eventosInseridos += batch.length;
          }
        }
        
        console.log(`✅ ${eventosInseridos} contatos vinculados à prospecção`);
        
        // Buscar dados da prospecção para log
        const { data: prospeccaoData } = await supabase
          .from('prospeccoes')
          .select('id, titulo, data_inicio, data_fim, canal, event_id_pri')
          .eq('id', prospeccaoId)
          .single();
        
        console.log('📊 Dados da prospecção:', prospeccaoData);
        console.log('✅ Contatos importados e vinculados. Disparo para IA será feito manualmente via botão "Disparar para IA".');
      }
      // Leads sem prospecção NÃO disparam webhook de status e não são vinculados
      
      if (data) setContatos(prev => [...data, ...prev]);
      
      // Mensagem diferenciada se houve duplicados
      const mensagemDuplicados = prospeccaoId 
        ? `${duplicados.length} já existiam neste evento e foram ignorados.`
        : `${duplicados.length} já existiam e foram ignorados.`;
      
      const mensagem = duplicados.length > 0 
        ? `${data?.length || 0} contatos adicionados. ${mensagemDuplicados}`
        : `${data?.length || 0} contatos adicionados com sucesso`;
      
      toast({ 
        title: "Sucesso", 
        description: mensagem
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

  // Atualizar dados de um contato
  const atualizarContato = async (contatoId: string, dados: Partial<Contato>) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .update(dados)
        .eq('id', contatoId);

      if (error) throw error;
      
      setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, ...dados } : c));
      
      return true;
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      throw error;
    }
  };

  // Dispara webhook de status para atendimento - APENAS para leads de campanhas WhatsApp
  const dispararWebhookStatusAtendimento = async (contatoId: string, telefone: string, status: string, evento: 'criacao' | 'mudanca_status', leadId?: number, prospeccaoId?: string) => {
    if (!activeCompany?.id) return;
    
    try {
      // Verificar se o contato pertence a uma prospecção WhatsApp via eventos_prospeccao
      const { data: vinculo } = await supabase
        .from('eventos_prospeccao')
        .select('prospeccao_id')
        .eq('contato_id', contatoId)
        .limit(1)
        .maybeSingle();
      
      const finalProspeccaoId = prospeccaoId || vinculo?.prospeccao_id;
      
      if (!finalProspeccaoId) {
        console.log('⏭️ Contato não pertence a nenhuma prospecção, webhook não disparado');
        return;
      }
      
      // Verificar se a prospecção é do tipo WhatsApp
      const { data: prospeccao } = await supabase
        .from('prospeccoes')
        .select('canal')
        .eq('id', finalProspeccaoId)
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
      
      console.log('🔔 Disparando webhook de status atendimento (campanha WhatsApp):', { telefone, status, evento, leadId: finalLeadId, prospeccao_id: finalProspeccaoId });
      
      const { data, error } = await supabase.functions.invoke('atendimento-status-webhook', {
        body: {
          telefone_lead: normalizePhone(telefone),
          status: status,
          empresa_id: activeCompany.id,
          evento: evento,
          leadId: finalLeadId,
          prospeccao_id: finalProspeccaoId
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
  const excluirContato = async (contatoId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.filter(c => c.id !== contatoId));
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      throw error;
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

  // Excluir prospecção - Com webhook para IA Ligação
  const excluirProspeccao = async (prospeccaoId: string) => {
    try {
      // Primeiro, buscar dados da prospecção para verificar se é IA Ligação
      const { data: prospeccaoData, error: fetchError } = await supabase
        .from('prospeccoes')
        .select('id, titulo, canal, event_id_pri, empresa_id')
        .eq('id', prospeccaoId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar prospecção:', fetchError);
        throw fetchError;
      }

      // Se for IA Ligação, chamar edge function (server-to-server) para evitar CORS
      const canalStr = String(prospeccaoData?.canal || '');
      const isLigacao = canalStr.toLowerCase().includes('liga');

      if (isLigacao && prospeccaoData?.event_id_pri) {
        const idEventoNum = parseInt(prospeccaoData.event_id_pri, 10);
        if (!Number.isFinite(idEventoNum)) {
          throw new Error(`event_id_pri inválido: ${prospeccaoData.event_id_pri}`);
        }

        console.log('📞 Excluindo evento no webhook (IA Ligação) via edge function:', prospeccaoData.titulo);
        console.log('🔢 ID do evento:', idEventoNum);

        const { data: webhookData, error: webhookError } = await supabase.functions.invoke('ia-ligacao-webhook', {
          body: {
            evento: {
              id: prospeccaoData.id,
              titulo: prospeccaoData.titulo,
              descricao: null,
              data_inicio: null,
              data_fim: null,
              canal: prospeccaoData.canal,
              evento_principal: false,
              qualificar_lead: false,
              imagem_divulgacao_url: null,
              uf: null,
              cidade: null,
              endereco: null,
              id_evento: idEventoNum,
            },
            contatos: [],
            empresa_id: prospeccaoData.empresa_id,
            acao: 'deletar',
          },
        });

        if (webhookError) {
          console.error('❌ Erro ao chamar edge function ia-ligacao-webhook (deletar):', webhookError);
          throw new Error('Falha ao excluir o evento no webhook (IA Ligação).');
        }

        const result: any = webhookData;
        if (result?.success === false || result?.error) {
          console.error('❌ Webhook retornou erro (deletar):', result);
          const detalhe =
            result?.data?.message ||
            result?.data?.hint ||
            result?.data?.raw ||
            result?.error ||
            result?.message ||
            'Falha ao excluir o evento.';
          throw new Error(`Webhook IA Ligação: ${detalhe}`);
        }

        console.log('✅ Evento removido no webhook (IA Ligação) com sucesso');
      }

      // Excluir no Supabase
      const { error } = await supabase
        .from('prospeccoes')
        .delete()
        .eq('id', prospeccaoId);

      if (error) {
        console.error('Erro ao excluir prospecção no banco:', error);
        throw error;
      }
      
      console.log('✅ Prospecção excluída do banco com sucesso');
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

  // Reenviar gatilhos para contatos específicos
  const reenviarGatilhos = async (contatoIds: string[], prospeccaoId: string): Promise<{ sucesso: number; falha: number }> => {
    if (!activeCompany?.id) {
      toast({ title: "Erro", description: "Nenhuma empresa ativa", variant: "destructive" });
      return { sucesso: 0, falha: 0 };
    }

    // Buscar dados dos contatos
    const { data: contatosData, error: contatosError } = await supabase
      .from('contatos')
      .select('id, nome, telefone, email, status, lead_id')
      .in('id', contatoIds);

    if (contatosError || !contatosData) {
      toast({ title: "Erro", description: "Erro ao buscar contatos", variant: "destructive" });
      return { sucesso: 0, falha: 0 };
    }

    // Buscar dados da prospecção
    const { data: prospeccaoData } = await supabase
      .from('prospeccoes')
      .select('id, titulo, data_inicio, data_fim, canal')
      .eq('id', prospeccaoId)
      .single();

    const BATCH_SIZE = 20;
    let sucesso = 0;
    let falha = 0;

    const processarContato = async (contato: typeof contatosData[0]) => {
      try {
        await supabase.functions.invoke('trigger-webhook', {
          body: {
            gatilho: 'novo_contato_prospeccao',
            dados: {
              contato_id: contato.id,
              lead_id: contato.lead_id,
              prospeccao_id: prospeccaoId,
              nome: contato.nome,
              telefone: normalizePhone(contato.telefone),
              email: contato.email,
              status: contato.status || 'Novo',
              prospeccao: {
                id: prospeccaoData?.id,
                nome: prospeccaoData?.titulo,
                data_inicio: prospeccaoData?.data_inicio,
                data_fim: prospeccaoData?.data_fim
              }
            }
          }
        });

        if (prospeccaoData?.canal === 'Whatsapp') {
          await supabase.functions.invoke('atendimento-status-webhook', {
            body: {
              telefone_lead: normalizePhone(contato.telefone),
              status: contato.status || 'Novo',
              empresa_id: activeCompany.id,
              evento: 'criacao',
              leadId: contato.lead_id,
              prospeccao_id: prospeccaoId
            }
          });
        }

        return true;
      } catch (error) {
        console.error('Erro ao reenviar gatilho:', contato.id, error);
        return false;
      }
    };

    for (let i = 0; i < contatosData.length; i += BATCH_SIZE) {
      const batch = contatosData.slice(i, i + BATCH_SIZE);
      const resultados = await Promise.all(batch.map(processarContato));
      sucesso += resultados.filter(r => r).length;
      falha += resultados.filter(r => !r).length;
    }

    return { sucesso, falha };
  };

  // Excluir um único contato
  const excluirContatoUnico = async (contatoId: string): Promise<boolean> => {
    try {
      console.log(`🗑️ Excluindo contato: ${contatoId}`);
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);
      
      if (error) {
        console.error('❌ Erro ao excluir contato:', error);
        return false;
      }
      
      setContatos(prev => prev.filter(c => c.id !== contatoId));
      console.log('✅ Contato excluído com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Exceção ao excluir contato:', error);
      return false;
    }
  };

  // Excluir múltiplos contatos de uma vez (todos de uma só vez, sem batches)
  const excluirContatosEmMassa = async (contatoIds: string[]): Promise<{ sucesso: number; falha: number }> => {
    if (contatoIds.length === 0) {
      return { sucesso: 0, falha: 0 };
    }

    // Se for apenas 1 contato, usar função individual
    if (contatoIds.length === 1) {
      const resultado = await excluirContatoUnico(contatoIds[0]);
      return resultado ? { sucesso: 1, falha: 0 } : { sucesso: 0, falha: 1 };
    }

    console.log(`🗑️ Excluindo ${contatoIds.length} contatos de uma vez`);

    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .in('id', contatoIds);

      if (error) {
        console.error('❌ Erro ao excluir contatos:', error);
        return { sucesso: 0, falha: contatoIds.length };
      }

      setContatos(prev => prev.filter(c => !contatoIds.includes(c.id)));

      console.log(`✅ ${contatoIds.length} contatos excluídos com sucesso`);
      return { sucesso: contatoIds.length, falha: 0 };
    } catch (error) {
      console.error('❌ Exceção ao excluir contatos:', error);
      return { sucesso: 0, falha: contatoIds.length };
    }
  };

  // Excluir TODOS os contatos da empresa (1 query, sem lista de IDs)
  const excluirTodosContatosDaEmpresa = async (): Promise<{ sucesso: number; falha: number }> => {
    if (!activeCompany?.id) {
      return { sucesso: 0, falha: 0 };
    }

    const total = contatos.length;
    if (total === 0) {
      return { sucesso: 0, falha: 0 };
    }

    console.log(`🧨 Excluindo TODOS os ${total} contatos da empresa ${activeCompany.id}`);

    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('empresa_id', activeCompany.id);

      if (error) {
        console.error('❌ Erro ao excluir todos os contatos:', error);
        return { sucesso: 0, falha: total };
      }

      setContatos([]);
      console.log('✅ Todos os contatos foram excluídos');
      return { sucesso: total, falha: 0 };
    } catch (error) {
      console.error('❌ Exceção ao excluir todos os contatos:', error);
      return { sucesso: 0, falha: total };
    }
  };

  // Disparar contatos para IA (apenas os que ainda não foram disparados)
  const dispararParaIA = async (prospeccaoId: string): Promise<{ total: number; disparados: number; jaDisparados: number }> => {
    if (!activeCompany?.id) {
      toast({ title: "Erro", description: "Nenhuma empresa ativa", variant: "destructive" });
      return { total: 0, disparados: 0, jaDisparados: 0 };
    }

    try {
      console.log('🚀 Iniciando disparo para IA - Prospecção:', prospeccaoId);
      
      // Buscar dados da prospecção
      const { data: prospeccaoData, error: prospeccaoError } = await supabase
        .from('prospeccoes')
        .select('id, titulo, data_inicio, data_fim, canal, event_id_pri')
        .eq('id', prospeccaoId)
        .single();
      
      if (prospeccaoError || !prospeccaoData) {
        toast({ title: "Erro", description: "Prospecção não encontrada", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      // Verificar se é IA Whatsapp ou IA Ligação
      const canalStr = String(prospeccaoData.canal || '').toLowerCase();
      const isIAWhatsapp = canalStr === 'whatsapp';
      const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
      
      if (!isIAWhatsapp && !isIALigacao) {
        toast({ 
          title: "Atenção", 
          description: `Esta prospecção é do tipo "${prospeccaoData.canal}" e não requer disparo para IA.`,
          variant: "destructive" 
        });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      // Buscar contatos vinculados à prospecção que ainda não foram disparados
      const { data: eventosContatos, error: eventosError } = await supabase
        .from('eventos_prospeccao')
        .select('contato_id')
        .eq('prospeccao_id', prospeccaoId);
      
      if (eventosError) {
        console.error('Erro ao buscar eventos:', eventosError);
        toast({ title: "Erro", description: "Erro ao buscar contatos da prospecção", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      const contatoIds = (eventosContatos || []).map(e => e.contato_id).filter(Boolean);
      
      if (contatoIds.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato encontrado nesta prospecção", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      // Buscar contatos que ainda não foram disparados (data_disparo_ia IS NULL)
      const { data: contatosNaoDisparados, error: contatosError } = await supabase
        .from('contatos')
        .select('id, lead_id, nome, telefone, email, status, origem')
        .in('id', contatoIds)
        .is('data_disparo_ia', null)
        .eq('empresa_id', activeCompany.id);
      
      if (contatosError) {
        console.error('Erro ao buscar contatos:', contatosError);
        toast({ title: "Erro", description: "Erro ao buscar contatos", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      const jaDisparados = contatoIds.length - (contatosNaoDisparados?.length || 0);
      
      if (!contatosNaoDisparados || contatosNaoDisparados.length === 0) {
        toast({ 
          title: "Atenção", 
          description: `Todos os ${contatoIds.length} contatos já foram disparados anteriormente.` 
        });
        return { total: contatoIds.length, disparados: 0, jaDisparados };
      }

      console.log(`📤 Disparando ${contatosNaoDisparados.length} contatos para IA (${jaDisparados} já foram disparados antes)`);

      // Chamar edge function com todos os leads de uma vez
      const { data: webhookResult, error: webhookError } = await supabase.functions.invoke('dispatch-leads-webhook', {
        body: {
          leads: contatosNaoDisparados.map(c => ({
            id: c.id,
            lead_id: c.lead_id,
            nome: c.nome,
            telefone: c.telefone,
            email: c.email,
            status: c.status,
            origem: c.origem
          })),
          prospeccao_id: prospeccaoId,
          empresa_id: activeCompany.id,
          prospeccao_data: {
            titulo: prospeccaoData.titulo,
            canal: prospeccaoData.canal,
            event_id_pri: prospeccaoData.event_id_pri,
            data_inicio: prospeccaoData.data_inicio,
            data_fim: prospeccaoData.data_fim
          }
        }
      });

      if (webhookError) {
        console.error('❌ Erro ao chamar dispatch-leads-webhook:', webhookError);
        toast({ title: "Erro", description: "Erro ao disparar para IA: " + webhookError.message, variant: "destructive" });
        return { total: contatoIds.length, disparados: 0, jaDisparados };
      }

      console.log('✅ Edge function retornou:', webhookResult);

      // Marcar contatos como disparados
      const contatoIdsDisparados = contatosNaoDisparados.map(c => c.id);
      const { error: updateError } = await supabase
        .from('contatos')
        .update({ data_disparo_ia: new Date().toISOString() })
        .in('id', contatoIdsDisparados);

      if (updateError) {
        console.error('Erro ao marcar contatos como disparados:', updateError);
      }

      const tipoIA = isIALigacao ? 'IA Ligação' : 'IA Whatsapp';
      toast({ 
        title: "Sucesso", 
        description: `${contatosNaoDisparados.length} contatos enviados para ${tipoIA}. ${jaDisparados > 0 ? `(${jaDisparados} já haviam sido enviados antes)` : ''}` 
      });

      return { total: contatoIds.length, disparados: contatosNaoDisparados.length, jaDisparados };
    } catch (error) {
      console.error('❌ Erro ao disparar para IA:', error);
      toast({ title: "Erro", description: "Erro ao disparar para IA: " + (error as Error).message, variant: "destructive" });
      return { total: 0, disparados: 0, jaDisparados: 0 };
    }
  };

  // Contar contatos pendentes de disparo para uma prospecção
  const contarContatosPendentesDisparo = async (prospeccaoId: string): Promise<{ total: number; pendentes: number; disparados: number }> => {
    if (!activeCompany?.id) return { total: 0, pendentes: 0, disparados: 0 };

    try {
      // Buscar contatos vinculados à prospecção
      const { data: eventosContatos } = await supabase
        .from('eventos_prospeccao')
        .select('contato_id')
        .eq('prospeccao_id', prospeccaoId);
      
      const contatoIds = (eventosContatos || []).map(e => e.contato_id).filter(Boolean);
      
      if (contatoIds.length === 0) return { total: 0, pendentes: 0, disparados: 0 };

      // Contar quantos ainda não foram disparados
      const { count: pendentes } = await supabase
        .from('contatos')
        .select('id', { count: 'exact', head: true })
        .in('id', contatoIds)
        .is('data_disparo_ia', null)
        .eq('empresa_id', activeCompany.id);
      
      const totalPendentes = pendentes || 0;
      const totalDisparados = contatoIds.length - totalPendentes;

      return { total: contatoIds.length, pendentes: totalPendentes, disparados: totalDisparados };
    } catch (error) {
      console.error('Erro ao contar contatos pendentes:', error);
      return { total: 0, pendentes: 0, disparados: 0 };
    }
  };

  return {
    contatos,
    prospeccoes,
    loading,
    adicionarContatos,
    atualizarContato,
    atualizarStatusContato,
    excluirContato,
    excluirContatosEmMassa,
    excluirTodosContatosDaEmpresa,
    atribuirResponsavel,
    getMetricas,
    updateDateFilter,
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    reenviarGatilhos,
    dispararParaIA,
    contarContatosPendentesDisparo,
    refetch: () => {
      fetchProspeccoes();
      fetchContatos();
    }
  };
};
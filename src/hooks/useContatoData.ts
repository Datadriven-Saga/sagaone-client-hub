import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone } from '@/lib/utils';

export interface Contato {
  id: string;
  lead_id?: number;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Novo' | 'Em Contato' | 'Qualificado' | 'Proposta' | 'Negociação' | 'Fechado' | 'Perdido' | 'Atribuído' | 'Convidado' | 'Agendado' | 'Confirmado' | 'Check-in' | 'Venda' | 'Descartado' | 'Desperdício' | 'Em Espera' | 'Opt Out';
  valor_potencial?: number;
  responsavel_email?: string;
  cliente_id?: string;
  empresa_id?: string;
  observacoes?: string;
  origem: 'Site' | 'WhatsApp' | 'Instagram' | 'Facebook' | 'Google' | 'Indicação' | 'Telefone' | 'Email' | 'Outros' | 'ligacao' | 'grande_evento' | 'prospeccao_mensal';
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
  ativo?: boolean; // Para eventos de IA Ligação - indica se está ativo ou desativado
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
  const [contatosProspeccoes, setContatosProspeccoes] = useState<Map<string, Set<string>>>(new Map()); // contato_id -> Set<prospeccao_id>
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
  // IMPORTANTE: Por padrão mostra TODOS os eventos (incluindo encerrados) para permitir importação/visualização
  const fetchProspeccoes = useCallback(async (showAllEvents: boolean = true) => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for prospeccoes');
      setProspeccoes([]);
      return;
    }

    try {
      console.log('🔍 Fetching prospeccoes for company:', activeCompany.id, '| showAllEvents:', showAllEvents);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar eventos da empresa
      // Eventos de Ligação com event_id_pri são controlados externamente e não devem ser filtrados por data
      let query = supabase
        .from('prospeccoes')
        .select(`
          id,
          titulo,
          descricao,
          data_inicio,
          data_fim,
          meta_leads,
          meta_novos,
          meta_seminovos,
          meta_diretas,
          meta_checkins,
          meta_confirmacoes,
          meta_convites,
          leads_gerados,
          responsavel_id,
          empresa_id,
          canal,
          persona_id,
          event_id_pri,
          ativo,
          created_at,
          updated_at,
          premio_equipe_campea,
          premio_equipe_2lugar,
          premio_equipe_3lugar,
          premio_vendedor_ouro,
          premio_vendedor_prata,
          premio_vendedor_bronze,
          premio_prospector_ouro,
          premio_prospector_prata,
          premio_prospector_bronze,
          premio_checkin_ouro,
          premio_checkin_prata,
          premio_checkin_bronze,
          premio_participacao_apoio,
          premio_indicacao_venda,
          imagem_divulgacao_url,
          template_prospeccao_id,
          template_agendado_id,
          template_nao_agendado_id,
          evento_principal,
          qualificar_lead,
          data_envio_template_inicial,
          data_envio_cadencia
        `)
        .eq('empresa_id', activeCompany.id);
      
      // Filtrar apenas eventos ativos (data_fim >= hoje) se NÃO for para mostrar todos
      // NOTA: Eventos de Ligação sempre são incluídos independente da data para permitir importação retroativa
      if (!showAllEvents) {
        // Usar filtro OR: data_fim >= hoje OU data_fim é null OU é evento de Ligação
        query = query.or(`data_fim.gte.${today},data_fim.is.null,canal.eq.Ligação`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

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
      setContatosProspeccoes(new Map());
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

      // Buscar vínculos contato <-> prospecção para permitir filtro por evento
      // CORREÇÃO: Buscar todos os vínculos da empresa diretamente (via prospeccao)
      // em vez de usar .in() com IDs que pode falhar com muitos contatos
      console.log('🔗 Fetching eventos_prospeccao links...');
      const contatoProspeccaoMap = new Map<string, Set<string>>();
      
      // Buscar IDs das prospecções da empresa para filtrar
      const prospeccaoIds = await supabase
        .from('prospeccoes')
        .select('id')
        .eq('empresa_id', activeCompany.id);
      
      const prosIds = (prospeccaoIds.data || []).map(p => p.id);
      
      if (prosIds.length > 0) {
        // Paginar busca de eventos_prospeccao usando .range() para paginação real
        const LINKS_PAGE_SIZE = 1000;
        let linksPage = 0;
        let linksHasMore = true;
        
        while (linksHasMore) {
          const { data: linksData, error: linksError } = await supabase
            .from('eventos_prospeccao')
            .select('contato_id, prospeccao_id')
            .in('prospeccao_id', prosIds)
            .not('contato_id', 'is', null)
            .not('prospeccao_id', 'is', null)
            .range(linksPage * LINKS_PAGE_SIZE, (linksPage + 1) * LINKS_PAGE_SIZE - 1);
          
          if (linksError) {
            console.error('Error fetching eventos_prospeccao:', linksError);
            break;
          }
          
          if (linksData && linksData.length > 0) {
            for (const link of linksData) {
              if (link.contato_id && link.prospeccao_id) {
                if (!contatoProspeccaoMap.has(link.contato_id)) {
                  contatoProspeccaoMap.set(link.contato_id, new Set());
                }
                contatoProspeccaoMap.get(link.contato_id)!.add(link.prospeccao_id);
              }
            }
            linksHasMore = linksData.length === LINKS_PAGE_SIZE;
            linksPage++;
            console.log(`📥 Vínculos página ${linksPage}: ${linksData.length} registros (total map: ${contatoProspeccaoMap.size})`);
          } else {
            linksHasMore = false;
          }
        }
      }
      
      console.log(`🔗 Vínculos carregados: ${contatoProspeccaoMap.size} contatos com prospecções`);
      setContatosProspeccoes(contatoProspeccaoMap);
      
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro", 
        description: "Erro ao carregar contatos: " + (error as Error).message,
        variant: "destructive"
      });
      setContatos([]);
      setContatosProspeccoes(new Map());
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

    // Se não tem empresa ativa mas o usuário está autenticado, parar loading imediatamente
    if (!activeCompany?.id) {
      console.log('⏳ No active company, stopping loading');
      setContatos([]);
      setProspeccoes([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      console.log('🔄 Loading data for company:', activeCompany.id);
      setLoading(true);
      
      try {
        // Carregar prospecções primeiro (rápido) e contatos em paralelo
        // Usar timeout para garantir que loading nunca fique infinito
        const timeout = new Promise<void>((resolve) => setTimeout(() => {
          console.log('⏰ Load timeout reached');
          resolve();
        }, 15000)); // 15 segundos máximo

        await Promise.race([
          Promise.all([
            fetchProspeccoes(true),
            fetchContatos()
          ]),
          timeout
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
  // Usa os últimos 11 dígitos para evitar conflitos (DDD + número completo)
  const normalizeTelefoneForComparison = (telefone: string): string => {
    const digitos = telefone.replace(/\D/g, '');
    // Se tiver código do país (55), remove. Mantém DDD + número (11 dígitos)
    if (digitos.startsWith('55') && digitos.length >= 12) {
      return digitos.slice(2); // Remove 55 do início
    }
    return digitos;
  };

  // Adicionar novos contatos - REGRA: 1 contato por pessoa, múltiplos eventos
  // Se o contato já existe (por telefone), apenas vincula ao novo evento
  // Nunca duplica leads
  const adicionarContatos = async (novosContatos: {
    nome: string;
    telefone: string;
    email?: string;
    origem: Contato['origem'];
    observacoes?: string;
    responsavel_email?: string;
    base_id?: string;
  }[], prospeccaoId?: string) => {
    if (!activeCompany?.id) {
      toast({ 
        title: "Erro", 
        description: "Empresa não selecionada", 
        variant: "destructive" 
      });
      return;
    }

    if (!prospeccaoId) {
      toast({ 
        title: "Erro", 
        description: "É obrigatório selecionar um evento para adicionar contatos", 
        variant: "destructive" 
      });
      return;
    }

    console.log('🚀 adicionarContatos chamada com:', { novosContatos: novosContatos.length, prospeccaoId });

    try {
      // 1) Buscar TODOS os contatos da empresa para identificar existentes (incluindo lead_id)
      const PAGE_SIZE = 1000;
      let allExistingContatos: { id: string; telefone: string | null; lead_id: number | null }[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('contatos')
          .select('id, telefone, lead_id')
          .eq('empresa_id', activeCompany.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (error) {
          console.error('Erro ao buscar contatos existentes:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allExistingContatos = [...allExistingContatos, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Criar mapa de telefone normalizado -> contato_id
      const telefoneToContatoId = new Map<string, string>();
      // Criar mapa de telefone normalizado -> lead_id (serial)
      const telefoneToLeadId = new Map<string, number | null>();
      for (const c of allExistingContatos) {
        if (c.telefone) {
          const telNorm = normalizeTelefoneForComparison(c.telefone);
          telefoneToContatoId.set(telNorm, c.id);
          telefoneToLeadId.set(telNorm, c.lead_id);
        }
      }

      console.log(`📊 ${allExistingContatos.length} contatos existentes na empresa`);

      // 2) Buscar vínculos já existentes neste evento específico
      const eventosExistentes = new Set<string>();
      let eventosPage = 0;
      let eventosHasMore = true;

      while (eventosHasMore) {
        const { data, error } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccaoId)
          .range(eventosPage * PAGE_SIZE, (eventosPage + 1) * PAGE_SIZE - 1);
        
        if (error) {
          console.error('Erro ao buscar vínculos existentes:', error);
          break;
        }
        
        if (data && data.length > 0) {
          data.forEach(e => { if (e.contato_id) eventosExistentes.add(e.contato_id); });
          eventosHasMore = data.length === PAGE_SIZE;
          eventosPage++;
        } else {
          eventosHasMore = false;
        }
      }

      console.log(`📊 ${eventosExistentes.size} contatos já vinculados a este evento`);

      // 3) Separar contatos em: 
      //    - existentes que precisam ser vinculados
      //    - novos que precisam ser criados e vinculados
      const contatosParaVincular: { id: string; telefone: string; nome: string; lead_id: number | null }[] = []; // Contatos existentes com dados
      const contatosParaCriar: typeof novosContatos = [];
      const jaVinculados: string[] = [];
      const telefonesProcessados = new Set<string>();

      for (const contato of novosContatos) {
        const telNorm = normalizeTelefoneForComparison(contato.telefone);
        
        // Evitar duplicatas dentro do próprio lote
        if (telefonesProcessados.has(telNorm)) {
          continue;
        }
        telefonesProcessados.add(telNorm);

        const contatoIdExistente = telefoneToContatoId.get(telNorm);
        
        if (contatoIdExistente) {
          // Contato já existe na empresa
          if (eventosExistentes.has(contatoIdExistente)) {
            // Já está vinculado a este evento
            jaVinculados.push(contato.nome);
          } else {
            // Precisa vincular ao evento - guardar dados completos incluindo lead_id
            const leadIdExistente = telefoneToLeadId.get(telNorm) || null;
            contatosParaVincular.push({
              id: contatoIdExistente,
              telefone: contato.telefone,
              nome: contato.nome,
              lead_id: leadIdExistente
            });
          }
        } else {
          // Contato novo, precisa criar
          contatosParaCriar.push(contato);
          // Adicionar ao mapa para evitar criar duplicados dentro do lote
          // O ID será preenchido após inserção
        }
      }

      console.log(`📊 Resumo: ${contatosParaCriar.length} novos, ${contatosParaVincular.length} existentes para vincular, ${jaVinculados.length} já vinculados`);

      // Manter IDs separados para retornar ao final
      const existentesVinculadosIds = contatosParaVincular.map(c => c.id);

      // 4) Criar novos contatos
      let novosContatosCriados: any[] = [];
      if (contatosParaCriar.length > 0) {
        const contatosComEmpresa = contatosParaCriar.map(contato => ({
          ...contato,
          status: 'Novo' as const,
          empresa_id: activeCompany.id
        }));

        const INSERT_BATCH_SIZE = 500;
        for (let i = 0; i < contatosComEmpresa.length; i += INSERT_BATCH_SIZE) {
          const batch = contatosComEmpresa.slice(i, i + INSERT_BATCH_SIZE);
          const { data: batchData, error: batchError } = await supabase
            .from('contatos')
            .insert(batch)
            .select('id, telefone, nome, lead_id, email, status, origem, empresa_id, created_at');

          if (batchError) {
            console.error(`❌ Erro ao inserir lote ${i + 1}:`, batchError);
          } else if (batchData) {
            console.log('📊 Contatos criados com lead_id:', 
              batchData.slice(0, 3).map(c => ({ id: c.id, lead_id: c.lead_id }))
            );
            novosContatosCriados = [...novosContatosCriados, ...batchData];
          }
        }
        console.log(`✅ ${novosContatosCriados.length} novos contatos criados`);

        // Fallback: buscar lead_id para contatos que não retornaram (edge case)
        const idsComLeadIdNull = novosContatosCriados
          .filter(c => c.lead_id === null || c.lead_id === undefined)
          .map(c => c.id);

        if (idsComLeadIdNull.length > 0) {
          console.log(`⚠️ ${idsComLeadIdNull.length} contatos sem lead_id, buscando...`);
          const { data: leadIds } = await supabase
            .from('contatos')
            .select('id, lead_id')
            .in('id', idsComLeadIdNull);
          
          if (leadIds) {
            const leadIdMap = new Map(leadIds.map(l => [l.id, l.lead_id]));
            novosContatosCriados = novosContatosCriados.map(c => ({
              ...c,
              lead_id: c.lead_id ?? leadIdMap.get(c.id) ?? null
            }));
            console.log('✅ lead_ids atualizados:', 
              novosContatosCriados.slice(0, 3).map(c => ({ id: c.id, lead_id: c.lead_id }))
            );
          }
        }
      }

      // 5) Vincular TODOS ao evento (novos + existentes que ainda não estavam)
      const todosIdsParaVincular = [
        ...existentesVinculadosIds,
        ...novosContatosCriados.map((c: any) => c.id)
      ];

      if (todosIdsParaVincular.length > 0) {
        const eventosParaInserir = todosIdsParaVincular.map(id => ({
          contato_id: id,
          prospeccao_id: prospeccaoId
        }));

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
      }

      // 6) Atualizar estado local
      if (novosContatosCriados.length > 0) {
        setContatos(prev => [...novosContatosCriados, ...prev]);
      }
      
      // Mensagem de sucesso
      const partes: string[] = [];
      if (novosContatosCriados.length > 0) {
        partes.push(`${novosContatosCriados.length} novos criados`);
      }
      if (contatosParaVincular.length > 0) {
        partes.push(`${contatosParaVincular.length} existentes vinculados`);
      }
      if (jaVinculados.length > 0) {
        partes.push(`${jaVinculados.length} já estavam no evento`);
      }
      
      toast({ 
        title: "Sucesso", 
        description: partes.join(', ') || 'Nenhum contato processado'
      });
      
      // Retornar todos os contatos processados (novos + existentes vinculados) com dados para webhook
      // Incluir lead_id (serial numérico) para todos os contatos
      const todosContatosProcessados = [
        ...novosContatosCriados.map((c: any) => ({ 
          id: c.id, 
          telefone: c.telefone, 
          nome: c.nome, 
          lead_id: typeof c.lead_id === 'number' ? c.lead_id : null 
        })),
        ...contatosParaVincular.map((c: any) => ({
          id: c.id,
          telefone: c.telefone,
          nome: c.nome,
          lead_id: typeof c.lead_id === 'number' ? c.lead_id : null
        }))
      ];

      console.log('📤 todosContatosProcessados para webhook:', 
        todosContatosProcessados.slice(0, 3).map(c => ({ id: c.id, lead_id: c.lead_id }))
      );
      
      return {
        novosContatosCriados,
        contatosVinculados: contatosParaVincular,
        todosContatosProcessados
      };
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

  // Desvincular contato de um evento específico (não exclui o contato)
  // Se o contato não tiver mais vínculos, ele permanece disponível para outros eventos
  const desvincularContatoDoEvento = async (contatoId: string, prospeccaoId: string): Promise<void> => {
    try {
      console.log(`🔗 Desvinculando contato ${contatoId} do evento ${prospeccaoId}`);
      
      const { error } = await supabase
        .from('eventos_prospeccao')
        .delete()
        .eq('contato_id', contatoId)
        .eq('prospeccao_id', prospeccaoId);

      if (error) {
        console.error('Erro ao desvincular contato do evento:', error);
        throw error;
      }
      
      console.log('✅ Contato desvinculado do evento com sucesso');
    } catch (error) {
      console.error('Erro ao desvincular contato:', error);
      throw error;
    }
  };

  // Excluir contato PERMANENTEMENTE
  // REGRA: Admin e TI podem excluir sempre; outros usuários só podem excluir contatos sem vínculos
  const excluirContato = async (contatoId: string, forcarExclusao: boolean = false): Promise<void> => {
    try {
      // Verificar se o contato tem vínculos com eventos
      const { data: vinculos, error: vinculosError } = await supabase
        .from('eventos_prospeccao')
        .select('id')
        .eq('contato_id', contatoId);

      if (vinculosError) {
        console.error('Erro ao verificar vínculos:', vinculosError);
        throw vinculosError;
      }

      const temVinculos = vinculos && vinculos.length > 0;

      // Se tem vínculos e não pode forçar exclusão, bloqueia
      if (temVinculos && !forcarExclusao) {
        throw new Error('Você não tem permissão para excluir contatos com vínculos. Apenas Administradores e TI podem fazer isso.');
      }

      // Se tem vínculos e pode forçar, primeiro exclui os vínculos
      if (temVinculos && forcarExclusao) {
        console.log('🔧 Admin/TI: Excluindo vínculos antes de excluir contato...');
        const { error: deleteVinculosError } = await supabase
          .from('eventos_prospeccao')
          .delete()
          .eq('contato_id', contatoId);

        if (deleteVinculosError) {
          console.error('Erro ao excluir vínculos:', deleteVinculosError);
          throw deleteVinculosError;
        }
        console.log('✅ Vínculos excluídos com sucesso');
      }

      // Agora pode excluir o contato
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.filter(c => c.id !== contatoId));
      console.log('✅ Contato excluído permanentemente');
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

  // Função auxiliar para registrar auditoria de prospecções
  const registrarAuditoriaProspeccao = async (
    prospeccaoId: string,
    acao: 'criacao' | 'edicao' | 'disparo_ia' | 'adicao_contatos' | 'remocao_contatos',
    dadosAnteriores?: any,
    dadosNovos?: any,
    detalhes?: string
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || '';
      
      // Buscar nome do usuário do profile
      let userName = userEmail;
      if (userData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome_completo')
          .eq('id', userData.user.id)
          .single();
        if (profile?.nome_completo) {
          userName = profile.nome_completo;
        }
      }

      // Usar any para contornar tipos ainda não atualizados
      await (supabase.from('logs_prospeccoes' as any) as any).insert({
        prospeccao_id: prospeccaoId,
        empresa_id: activeCompany?.id,
        usuario_id: userData?.user?.id,
        usuario_nome: userName,
        usuario_email: userEmail,
        acao,
        dados_anteriores: dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
        dados_novos: dadosNovos ? JSON.stringify(dadosNovos) : null,
        detalhes
      });
      console.log(`📝 Auditoria registrada: ${acao} para prospecção ${prospeccaoId}`);
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error);
      // Não propagar erro para não afetar a operação principal
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
        
        // Registrar auditoria de criação
        await registrarAuditoriaProspeccao(
          data.id,
          'criacao',
          null,
          { titulo: data.titulo, canal: data.canal, data_inicio: data.data_inicio, data_fim: data.data_fim },
          `Evento "${data.titulo}" criado`
        );
        
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

  // Editar prospecção - Com auditoria
  const editarProspeccao = async (prospeccaoId: string, dadosAtualizados: Partial<Prospeccao>) => {
    try {
      // Buscar dados anteriores para auditoria
      const { data: dadosAnteriores } = await supabase
        .from('prospeccoes')
        .select('titulo, canal, data_inicio, data_fim, descricao')
        .eq('id', prospeccaoId)
        .single();

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
        
        // Registrar auditoria de edição
        await registrarAuditoriaProspeccao(
          prospeccaoId,
          'edicao',
          dadosAnteriores,
          { titulo: data.titulo, canal: data.canal, data_inicio: data.data_inicio, data_fim: data.data_fim },
          `Evento "${data.titulo}" editado`
        );
        
        setProspeccoes(prev => prev.map(p => p.id === prospeccaoId ? prospeccaoFormatada : p));
      }
    } catch (error) {
      console.error('Erro ao editar prospecção:', error);
      throw error;
    }
  };

  // Excluir prospecção - Com webhook para IA Ligação
  // IMPORTANTE: Eventos de IA Ligação NÃO podem ser excluídos, apenas desativados
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

      // Se for IA Ligação, NÃO permitir exclusão - apenas desativação via toggleEventoAtivo
      const canalStr = String(prospeccaoData?.canal || '');
      const isLigacao = canalStr.toLowerCase().includes('liga');

      if (isLigacao) {
        throw new Error('Eventos de IA Ligação não podem ser excluídos. Use a opção de desativar.');
      }

      // Excluir no Supabase (apenas para eventos não-Ligação)
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

  // Ativar/Desativar evento de IA Ligação (envia status para webhook externo)
  // APENAS para Admin e TI
  const toggleEventoLigacaoAtivo = async (prospeccaoId: string, novoAtivo: boolean) => {
    try {
      // Buscar sem coluna 'ativo' para evitar erro de tipos até regenerar
      const { data: prospeccaoData, error: fetchError } = await supabase
        .from('prospeccoes')
        .select('id, titulo, descricao, data_inicio, data_fim, canal, event_id_pri, empresa_id')
        .eq('id', prospeccaoId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar prospecção:', fetchError);
        throw fetchError;
      }

      const canalStr = String(prospeccaoData?.canal || '');
      const isLigacao = canalStr.toLowerCase().includes('liga');

      if (!isLigacao) {
        throw new Error('Esta função é apenas para eventos de IA Ligação.');
      }

      if (!prospeccaoData?.event_id_pri) {
        throw new Error('Evento não possui ID externo (event_id_pri).');
      }

      const idEventoNum = parseInt(prospeccaoData.event_id_pri, 10);
      if (!Number.isFinite(idEventoNum)) {
        throw new Error(`event_id_pri inválido: ${prospeccaoData.event_id_pri}`);
      }

      console.log(`📞 ${novoAtivo ? 'Ativando' : 'Desativando'} evento no webhook (IA Ligação):`, prospeccaoData.titulo);

      // Chamar edge function ia-ligacao-webhook com acao 'ativar' ou 'desativar' para mudar status
      const { data: webhookData, error: webhookError } = await supabase.functions.invoke('ia-ligacao-webhook', {
        body: {
          evento: {
            id: prospeccaoId,
            titulo: prospeccaoData.titulo,
            descricao: prospeccaoData.descricao,
            data_inicio: prospeccaoData.data_inicio,
            data_fim: prospeccaoData.data_fim,
            canal: prospeccaoData.canal,
            evento_principal: false,
            qualificar_lead: false,
            imagem_divulgacao_url: null,
            id_evento: idEventoNum,
            uf: null,
            cidade: null,
            endereco: null,
          },
          empresa_id: prospeccaoData.empresa_id,
          acao: novoAtivo ? 'ativar' : 'desativar',
        },
      });

      if (webhookError) {
        console.error(`❌ Erro ao ${novoAtivo ? 'ativar' : 'desativar'} evento:`, webhookError);
        throw new Error(`Falha ao ${novoAtivo ? 'ativar' : 'desativar'} o evento no webhook.`);
      }

      const result: any = webhookData;
      if (result?.success === false || result?.error) {
        console.error('❌ Webhook retornou erro:', result);
        throw new Error(result?.error || `Falha ao ${novoAtivo ? 'ativar' : 'desativar'} o evento.`);
      }

      // Atualizar no Supabase local (usando cast para bypass de tipos até regenerar)
      const { error: updateError } = await supabase
        .from('prospeccoes')
        .update({ ativo: novoAtivo } as any)
        .eq('id', prospeccaoId);

      if (updateError) {
        console.error('Erro ao atualizar status no banco:', updateError);
        throw updateError;
      }

      console.log(`✅ Evento ${novoAtivo ? 'ativado' : 'desativado'} com sucesso`);
      setProspeccoes(prev => prev.map(p => p.id === prospeccaoId ? { ...p, ativo: novoAtivo } : p));
      
      return true;
    } catch (error) {
      console.error('Erro ao alterar status do evento:', error);
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

    // Buscar dados dos contatos em lotes para evitar URL longa
    const IN_BATCH_SIZE = 200;
    let contatosData: { id: string; nome: string; telefone: string; email: string | null; status: string; lead_id: number | null }[] = [];
    
    for (let i = 0; i < contatoIds.length; i += IN_BATCH_SIZE) {
      const batchIds = contatoIds.slice(i, i + IN_BATCH_SIZE);
      const { data: batchData, error: batchError } = await supabase
        .from('contatos')
        .select('id, nome, telefone, email, status, lead_id')
        .in('id', batchIds);

      if (batchError) {
        toast({ title: "Erro", description: "Erro ao buscar contatos", variant: "destructive" });
        return { sucesso: 0, falha: 0 };
      }
      if (batchData) {
        contatosData = [...contatosData, ...batchData];
      }
    }

    if (contatosData.length === 0) {
      toast({ title: "Erro", description: "Nenhum contato encontrado", variant: "destructive" });
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

  // Desvincular um único contato de um evento específico
  const desvincularContatoUnico = async (contatoId: string, prospeccaoId: string): Promise<boolean> => {
    try {
      console.log(`🔗 Desvinculando contato ${contatoId} do evento ${prospeccaoId}`);
      
      const { error } = await supabase
        .from('eventos_prospeccao')
        .delete()
        .eq('contato_id', contatoId)
        .eq('prospeccao_id', prospeccaoId);
      
      if (error) {
        console.error('❌ Erro ao desvincular contato:', error);
        return false;
      }
      
      console.log('✅ Contato desvinculado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Exceção ao desvincular contato:', error);
      return false;
    }
  };

  // Desvincular múltiplos contatos de um evento específico
  // REGRA: Apenas desvincula do evento, não exclui os contatos
  const desvincularContatosDoEvento = async (contatoIds: string[], prospeccaoId: string): Promise<{ sucesso: number; falha: number }> => {
    if (contatoIds.length === 0 || !prospeccaoId) {
      return { sucesso: 0, falha: 0 };
    }

    console.log(`🔗 Desvinculando ${contatoIds.length} contatos do evento ${prospeccaoId}`);

    try {
      const DELETE_BATCH_SIZE = 200;
      let desvinculados = 0;
      let errors = 0;
      
      for (let i = 0; i < contatoIds.length; i += DELETE_BATCH_SIZE) {
        const batchIds = contatoIds.slice(i, i + DELETE_BATCH_SIZE);
        
        const { error } = await supabase
          .from('eventos_prospeccao')
          .delete()
          .in('contato_id', batchIds)
          .eq('prospeccao_id', prospeccaoId);

        if (error) {
          console.error(`❌ Erro ao desvincular lote ${Math.floor(i / DELETE_BATCH_SIZE) + 1}:`, error);
          errors += batchIds.length;
        } else {
          desvinculados += batchIds.length;
        }
      }

      console.log(`✅ ${desvinculados} contatos desvinculados (${errors} erros)`);
      return { sucesso: desvinculados, falha: errors };
    } catch (error) {
      console.error('❌ Exceção ao desvincular contatos:', error);
      return { sucesso: 0, falha: contatoIds.length };
    }
  };

  // LEGACY: Manter para compatibilidade - agora apenas desvincula
  const excluirContatoUnico = async (contatoId: string, prospeccaoId?: string): Promise<boolean> => {
    if (prospeccaoId) {
      return desvincularContatoUnico(contatoId, prospeccaoId);
    }
    // Sem prospeccaoId, tenta excluir permanentemente (apenas se não tiver vínculos)
    try {
      await excluirContato(contatoId);
      return true;
    } catch {
      return false;
    }
  };

  // LEGACY: Manter para compatibilidade - agora desvincula do evento
  const excluirContatosEmMassa = async (contatoIds: string[], prospeccaoId?: string, forcarExclusao: boolean = false): Promise<{ sucesso: number; falha: number }> => {
    if (contatoIds.length === 0) {
      return { sucesso: 0, falha: 0 };
    }

    // Se tiver prospeccaoId, desvincular do evento
    if (prospeccaoId) {
      return desvincularContatosDoEvento(contatoIds, prospeccaoId);
    }

    // Sem prospeccaoId, buscar contatos sem vínculos para excluir permanentemente
    console.log(`🗑️ Verificando ${contatoIds.length} contatos para exclusão permanente (forçar: ${forcarExclusao})`);

    try {
      const DELETE_BATCH_SIZE = 200;
      let deletedCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < contatoIds.length; i += DELETE_BATCH_SIZE) {
        const batchIds = contatoIds.slice(i, i + DELETE_BATCH_SIZE);
        
        // Verificar quais contatos têm vínculos
        const { data: vinculos } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .in('contato_id', batchIds);
        
        const contatosComVinculos = new Set((vinculos || []).map(v => v.contato_id));
        const contatosSemVinculos = batchIds.filter(id => !contatosComVinculos.has(id));
        const contatosComVinculosArray = batchIds.filter(id => contatosComVinculos.has(id));
        
        // Se pode forçar exclusão, primeiro excluir os vínculos dos contatos com vínculos
        if (forcarExclusao && contatosComVinculosArray.length > 0) {
          console.log(`🔧 Admin/TI: Excluindo vínculos de ${contatosComVinculosArray.length} contatos...`);
          const { error: deleteVinculosError } = await supabase
            .from('eventos_prospeccao')
            .delete()
            .in('contato_id', contatosComVinculosArray);

          if (deleteVinculosError) {
            console.error('Erro ao excluir vínculos:', deleteVinculosError);
            skippedCount += contatosComVinculosArray.length;
          } else {
            // Agora pode excluir os contatos que tinham vínculos
            const { error: deleteContatosVinculosError } = await supabase
              .from('contatos')
              .delete()
              .in('id', contatosComVinculosArray);

            if (deleteContatosVinculosError) {
              console.error('Erro ao excluir contatos com vínculos:', deleteContatosVinculosError);
              skippedCount += contatosComVinculosArray.length;
            } else {
              deletedCount += contatosComVinculosArray.length;
            }
          }
        } else {
          // Sem permissão para forçar, conta como falha
          skippedCount += contatosComVinculos.size;
        }
        
        // Excluir contatos sem vínculos normalmente
        if (contatosSemVinculos.length > 0) {
          const { error } = await supabase
            .from('contatos')
            .delete()
            .in('id', contatosSemVinculos);

          if (error) {
            console.error(`❌ Erro ao excluir lote:`, error);
          } else {
            deletedCount += contatosSemVinculos.length;
          }
        }
      }

      setContatos(prev => prev.filter(c => !contatoIds.includes(c.id)));

      console.log(`✅ ${deletedCount} contatos excluídos, ${skippedCount} mantidos (têm vínculos ou erro)`);
      return { sucesso: deletedCount, falha: skippedCount };
    } catch (error) {
      console.error('❌ Exceção ao excluir contatos:', error);
      return { sucesso: 0, falha: contatoIds.length };
    }
  };

  // Excluir TODOS os contatos da empresa (com cascata manual para eventos_prospeccao)
  // REGRA: Apenas Admin e TI podem usar esta função
  // Observação: o PostgREST costuma limitar selects grandes (ex: 1000 linhas), então aqui paginamos.
  const excluirTodosContatosDaEmpresa = async (forcarExclusao: boolean = false): Promise<{ sucesso: number; falha: number }> => {
    if (!forcarExclusao) {
      console.error('❌ Apenas Admin/TI podem excluir todos os contatos');
      return { sucesso: 0, falha: 0 };
    }
    
    if (!activeCompany?.id) {
      return { sucesso: 0, falha: 0 };
    }

    const totalEmTela = contatos.length;
    if (totalEmTela === 0) {
      return { sucesso: 0, falha: 0 };
    }

    console.log(`🧨 Excluindo TODOS os contatos da empresa ${activeCompany.id}`);

    try {
      // 1) Buscar TODOS os IDs de contatos da empresa em páginas
      const PAGE_SIZE = 5000;
      let from = 0;
      const contatoIds: string[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('contatos')
          .select('id')
          .eq('empresa_id', activeCompany.id)
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('❌ Erro ao buscar contatos para exclusão:', error);
          return { sucesso: 0, falha: totalEmTela };
        }

        const ids = (data || []).map((c) => c.id);
        contatoIds.push(...ids);

        if (!data || data.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      console.log(`📊 Encontrados ${contatoIds.length} contatos no banco para excluir`);

      if (contatoIds.length === 0) {
        // Já não existe nada no banco
        setContatos([]);
        return { sucesso: 0, falha: 0 };
      }

      // 2) Excluir em lotes: primeiro eventos_prospeccao, depois contatos
      const DELETE_BATCH_SIZE = 200;
      let sucesso = 0;
      let falha = 0;

      console.log(`🔄 Excluindo em lotes de ${DELETE_BATCH_SIZE} (eventos_prospeccao → contatos)...`);

      for (let i = 0; i < contatoIds.length; i += DELETE_BATCH_SIZE) {
        const batchIds = contatoIds.slice(i, i + DELETE_BATCH_SIZE);

        // 2.1) Deletar eventos vinculados aos contatos
        const { error: eventosError } = await supabase
          .from('eventos_prospeccao')
          .delete()
          .in('contato_id', batchIds);

        if (eventosError) {
          // Mesmo com erro, tentamos excluir os contatos para contabilizar falhas corretamente
          console.warn(`⚠️ Erro ao excluir eventos_prospeccao lote ${i}-${i + DELETE_BATCH_SIZE}:`, eventosError);
        }

        // 2.2) Deletar os contatos
        const { error: contatosError } = await supabase
          .from('contatos')
          .delete()
          .in('id', batchIds);

        if (contatosError) {
          console.error(`❌ Erro ao excluir contatos lote ${i}-${i + DELETE_BATCH_SIZE}:`, contatosError);
          falha += batchIds.length;
        } else {
          sucesso += batchIds.length;
        }
      }

      if (falha === 0) {
        setContatos([]);
        console.log('✅ Todos os contatos foram excluídos');
        return { sucesso, falha: 0 };
      }

      // Exclusão parcial: remove apenas os que “tentamos” deletar com sucesso do estado
      // (se a tela estiver paginada, isso mantém a UI consistente)
      const deletedSet = new Set(contatoIds);
      setContatos((prev) => prev.filter((c) => !deletedSet.has(c.id)));

      console.warn(`⚠️ Exclusão parcial: ${sucesso} excluídos, ${falha} falharam`);
      return { sucesso, falha };
    } catch (error) {
      console.error('❌ Exceção ao excluir todos os contatos:', error);
      return { sucesso: 0, falha: totalEmTela };
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

      // Buscar contatos vinculados à prospecção que ainda não foram disparados NESTE EVENTO
      // Usamos data_disparo_ia na tabela eventos_prospeccao (por evento) ao invés de contatos (global)
      const { data: eventosContatos, error: eventosError } = await supabase
        .from('eventos_prospeccao')
        .select('id, contato_id, data_disparo_ia')
        .eq('prospeccao_id', prospeccaoId);
      
      if (eventosError) {
        console.error('Erro ao buscar eventos:', eventosError);
        toast({ title: "Erro", description: "Erro ao buscar contatos da prospecção", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      const totalEventos = eventosContatos?.length || 0;
      
      if (totalEventos === 0) {
        toast({ title: "Atenção", description: "Nenhum contato encontrado nesta prospecção", variant: "destructive" });
        return { total: 0, disparados: 0, jaDisparados: 0 };
      }

      // Filtrar apenas os que não foram disparados NESTE EVENTO
      const eventosNaoDisparados = (eventosContatos || []).filter(e => !e.data_disparo_ia);
      const contatoIdsNaoDisparados = eventosNaoDisparados.map(e => e.contato_id).filter(Boolean) as string[];
      const jaDisparados = totalEventos - eventosNaoDisparados.length;
      
      if (contatoIdsNaoDisparados.length === 0) {
        toast({ 
          title: "Atenção", 
          description: `Todos os ${totalEventos} contatos já foram disparados neste evento.` 
        });
        return { total: totalEventos, disparados: 0, jaDisparados };
      }

      // Buscar dados dos contatos não disparados
      const IN_BATCH_SIZE = 200;
      let contatosNaoDisparados: { id: string; lead_id: number | null; nome: string; telefone: string; email: string | null; status: string; origem: string | null }[] = [];
      
      for (let i = 0; i < contatoIdsNaoDisparados.length; i += IN_BATCH_SIZE) {
        const batchIds = contatoIdsNaoDisparados.slice(i, i + IN_BATCH_SIZE);
        const { data: batchData, error: batchError } = await supabase
          .from('contatos')
          .select('id, lead_id, nome, telefone, email, status, origem')
          .in('id', batchIds)
          .eq('empresa_id', activeCompany.id);
        
        if (batchError) {
          console.error('Erro ao buscar contatos lote:', batchError);
          continue;
        }
        if (batchData) {
          contatosNaoDisparados = [...contatosNaoDisparados, ...batchData];
        }
      }
      
      if (contatosNaoDisparados.length === 0) {
        toast({ 
          title: "Atenção", 
          description: `Todos os ${totalEventos} contatos já foram disparados neste evento.` 
        });
        return { total: totalEventos, disparados: 0, jaDisparados };
      }

      console.log(`📤 Disparando ${contatosNaoDisparados.length} contatos para IA (${jaDisparados} já foram disparados antes)`);

      // Preparar leads para envio
      const allLeads = contatosNaoDisparados.map(c => ({
        id: c.id,
        lead_id: c.lead_id,
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        status: c.status,
        origem: c.origem
      }));

      // DIVIDIR EM BATCHES DE 500 PARA EVITAR TIMEOUT DA EDGE FUNCTION
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(allLeads.length / BATCH_SIZE);
      let totalErros = 0;
      let totalSucessos = 0;

      console.log(`📦 Dividindo em ${totalBatches} batches de até ${BATCH_SIZE} leads cada`);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const leads = allLeads.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = batchIndex + 1;

        console.log(`📤 Enviando batch ${batchNum}/${totalBatches} (${leads.length} leads)`);

        try {
          const { data, error } = await supabase.functions.invoke('dispatch-leads-webhook', {
            body: {
              leads,
              prospeccao_id: prospeccaoId,
              empresa_id: activeCompany.id,
              prospeccao_data: {
                titulo: prospeccaoData.titulo,
                canal: prospeccaoData.canal,
                event_id_pri: prospeccaoData.event_id_pri,
                data_inicio: prospeccaoData.data_inicio,
                data_fim: prospeccaoData.data_fim,
                template_prospeccao_id: (prospeccaoData as any).template_prospeccao_id || null
              }
            }
          });

          if (error) {
            console.error(`❌ Erro no batch ${batchNum}:`, error);
            totalErros += leads.length;
          } else {
            console.log(`✅ Batch ${batchNum} concluído:`, data);
            totalSucessos += data?.leads_processados || leads.length;
          }
        } catch (batchError) {
          console.error(`❌ Exceção no batch ${batchNum}:`, batchError);
          totalErros += leads.length;
        }
      }

      console.log(`📊 Disparo concluído: ${totalSucessos} sucessos, ${totalErros} erros`);

      // Marcar contatos como disparados na tabela eventos_prospeccao (por evento, não global)
      const contatoIdsDisparados = contatosNaoDisparados.map(c => c.id);
      const UPDATE_BATCH_SIZE = 200;
      
      for (let i = 0; i < contatoIdsDisparados.length; i += UPDATE_BATCH_SIZE) {
        const batchIds = contatoIdsDisparados.slice(i, i + UPDATE_BATCH_SIZE);
        const { error: updateError } = await supabase
          .from('eventos_prospeccao')
          .update({ data_disparo_ia: new Date().toISOString() })
          .eq('prospeccao_id', prospeccaoId)
          .in('contato_id', batchIds);

        if (updateError) {
          console.error(`Erro ao marcar lote ${Math.floor(i / UPDATE_BATCH_SIZE) + 1} como disparados:`, updateError);
        }
      }

      const tipoIA = isIALigacao ? 'IA Ligação' : 'IA Whatsapp';
      
      if (totalErros > 0) {
        toast({ 
          title: "Parcialmente concluído", 
          description: `${totalSucessos} disparados, ${totalErros} erros`,
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Sucesso", 
          description: `${contatosNaoDisparados.length} contatos enviados para ${tipoIA}. ${jaDisparados > 0 ? `(${jaDisparados} já haviam sido enviados neste evento)` : ''}` 
        });
      }

      return { total: totalEventos, disparados: contatosNaoDisparados.length, jaDisparados };
    } catch (error) {
      console.error('❌ Erro ao disparar para IA:', error);
      toast({ title: "Erro", description: "Erro ao disparar para IA: " + (error as Error).message, variant: "destructive" });
      return { total: 0, disparados: 0, jaDisparados: 0 };
    }
  };

  // Contar contatos pendentes de disparo para uma prospecção - OTIMIZADO usando função SQL
  const contarContatosPendentesDisparo = async (prospeccaoId: string): Promise<{ total: number; pendentes: number; disparados: number }> => {
    if (!activeCompany?.id) return { total: 0, pendentes: 0, disparados: 0 };

    try {
      // Usar função SQL otimizada que faz contagem agregada no banco
      const { data: metricasData, error } = await supabase
        .rpc('get_prospeccao_metricas' as any, {
          p_prospeccao_id: prospeccaoId,
          p_empresa_id: activeCompany.id
        });

      if (error) {
        console.error('Erro ao buscar métricas via RPC:', error);
        return { total: 0, pendentes: 0, disparados: 0 };
      }

      if (metricasData && Array.isArray(metricasData) && metricasData.length > 0) {
        const m = metricasData[0] as { total: number; pendentes: number; disparados: number; vendas: number };
        return {
          total: Number(m.total) || 0,
          pendentes: Number(m.pendentes) || 0,
          disparados: Number(m.disparados) || 0
        };
      }

      return { total: 0, pendentes: 0, disparados: 0 };
    } catch (error) {
      console.error('Erro ao contar contatos pendentes:', error);
      return { total: 0, pendentes: 0, disparados: 0 };
    }
  };

  return {
    contatos,
    prospeccoes,
    contatosProspeccoes, // Mapa contato_id -> Set<prospeccao_id> para filtrar por evento
    loading,
    adicionarContatos,
    atualizarContato,
    atualizarStatusContato,
    excluirContato,
    excluirContatosEmMassa,
    excluirTodosContatosDaEmpresa,
    desvincularContatoDoEvento,
    desvincularContatosDoEvento,
    desvincularTodosDoEvento: async (prospeccaoId: string) => {
      // Desvincular todos de um evento específico
      if (!activeCompany?.id || !prospeccaoId) return { sucesso: 0, falha: 0 };
      
      console.log(`🔗 Desvinculando TODOS do evento ${prospeccaoId}`);
      const PAGE_SIZE = 1000;
      let from = 0;
      const contatoIds: string[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccaoId)
          .range(from, from + PAGE_SIZE - 1);

        if (error || !data || data.length === 0) break;
        contatoIds.push(...data.map(e => e.contato_id).filter(Boolean) as string[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (contatoIds.length === 0) return { sucesso: 0, falha: 0 };
      return desvincularContatosDoEvento(contatoIds, prospeccaoId);
    },
    atribuirResponsavel,
    getMetricas,
    updateDateFilter,
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    toggleEventoLigacaoAtivo,
    reenviarGatilhos,
    dispararParaIA,
    contarContatosPendentesDisparo,
    fetchProspeccoes,
    refetch: async () => {
      console.log('🔄 Refetch triggered...');
      await Promise.all([fetchProspeccoes(), fetchContatos()]);
      console.log('✅ Refetch completed');
    }
  };
};
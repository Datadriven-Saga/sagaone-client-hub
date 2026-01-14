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
      
      if (prospeccaoId) {
        // Buscar contatos JÁ vinculados a esta prospecção específica via eventos_prospeccao
        const { data: eventosProspeccao } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccaoId);
        
        const contatoIdsNaProspeccao = (eventosProspeccao || []).map(e => e.contato_id).filter(Boolean);
        
        if (contatoIdsNaProspeccao.length > 0) {
          // Buscar telefones dos contatos que já estão nesta prospecção
          const { data: contatosNaProspeccao } = await supabase
            .from('contatos')
            .select('telefone, email')
            .in('id', contatoIdsNaProspeccao);
          
          telefonesExistentes = new Set(
            (contatosNaProspeccao || [])
              .filter(c => c.telefone)
              .map(c => normalizeTelefoneForComparison(c.telefone!))
          );
          emailsExistentes = new Set(
            (contatosNaProspeccao || [])
              .filter(c => c.email)
              .map(c => c.email!.toLowerCase())
          );
        }
        
        console.log(`📊 Verificando duplicados para prospecção ${prospeccaoId}:`, {
          contatosExistentes: contatoIdsNaProspeccao.length,
          telefonesUnicos: telefonesExistentes.size
        });
      } else {
        // Verificar duplicados globais na empresa (comportamento original)
        const { data: contatosExistentes } = await supabase
          .from('contatos')
          .select('telefone, email')
          .eq('empresa_id', activeCompany.id);
        
        telefonesExistentes = new Set(
          (contatosExistentes || [])
            .filter(c => c.telefone)
            .map(c => normalizeTelefoneForComparison(c.telefone!))
        );
        emailsExistentes = new Set(
          (contatosExistentes || [])
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
          .select('id, titulo, data_inicio, data_fim, canal, event_id_pri')
          .eq('id', prospeccaoId)
          .single();
        
        console.log('📊 Dados da prospecção para webhook:', prospeccaoData);
        
        // Processar em lotes paralelos para maior velocidade
        const BATCH_SIZE = 20; // Processa 20 contatos por vez em paralelo
        
        const processarContato = async (contato: typeof data[0]) => {
          try {
            // Webhook de prospecção (existente) - inclui lead_id
            const webhookResponse = await supabase.functions.invoke('trigger-webhook', {
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
            
            // Webhook de status para atendimento - APENAS para campanhas WhatsApp
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
            
            return { success: true, id: contato.id };
          } catch (webhookError) {
            console.error('Erro ao disparar webhook para contato:', contato.id, webhookError);
            return { success: false, id: contato.id };
          }
        };
        
        // Processar em batches paralelos
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const batch = data.slice(i, i + BATCH_SIZE);
          console.log(`📦 Processando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.length / BATCH_SIZE)} (${batch.length} contatos)`);
          
          await Promise.all(batch.map(processarContato));
        }
        
        console.log('✅ Todos os webhooks individuais disparados');
        
        // Determinar se é IA Whatsapp ou IA Ligação para escolher agente e webhook corretos
        const canalStr = String(prospeccaoData?.canal || '').toLowerCase();
        const isIAWhatsapp = canalStr === 'whatsapp';
        const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
        
        // WEBHOOK RECEBE-LEADS-PRI - Para IA Whatsapp e IA Ligação (webhooks diferentes)
        if (isIAWhatsapp || isIALigacao) {
          const tipoIA = isIALigacao ? 'IA Ligação' : 'IA Whatsapp';
          console.log(`📤 Enviando leads individualmente para webhook (${tipoIA})...`);
          
          try {
            // Buscar dados da empresa para pegar crm_id e agente Pri
            const { data: empresaData } = await supabase
              .from('empresas')
              .select('crm_id, nome_empresa, uf, cidade')
              .eq('id', activeCompany.id)
              .single();
            
            // Buscar agente correto vinculado à loja
            // IA Whatsapp → "Pri - Whatsapp" | IA Ligação → "Pri(Ligação)"
            let telefonePri = '';
            let nomeAgente = '';

            const { data: agentesVinculados, error: agentesVinculadosErr } = await supabase
              .from('agente_empresas')
              .select(`
                agente_id,
                agentes_ia (
                  id,
                  nome,
                  telefone,
                  ativo
                )
              `)
              .eq('empresa_id', activeCompany.id);

            if (agentesVinculadosErr) {
              console.error('❌ Erro ao buscar agentes vinculados (agente_empresas):', agentesVinculadosErr);
            }

            const agentes = (agentesVinculados || [])
              .map((ae: any) => ae.agentes_ia)
              .filter((a: any) => a && a.ativo)
              .filter((a: any, idx: number, self: any[]) => idx === self.findIndex(t => t?.id === a?.id));

            const normalizeTelefonePri = (value: any) => (value ? String(value).replace(/\D/g, '') : '');

            // Padrões de busca para cada tipo de IA
            const agenteSearchPatterns = isIALigacao 
              ? ['ligação', 'ligacao', 'ligaçao'] 
              : ['whatsapp'];

            // Buscar agente específico para o tipo de evento
            const agenteEspecifico = agentes.find((a: any) => {
              const nome = String(a?.nome || '').toLowerCase();
              const temPri = nome.includes('pri');
              const temPatternCorreto = agenteSearchPatterns.some(pattern => nome.includes(pattern));
              return temPri && temPatternCorreto && normalizeTelefonePri(a?.telefone);
            });

            if (agenteEspecifico) {
              telefonePri = normalizeTelefonePri(agenteEspecifico.telefone);
              nomeAgente = agenteEspecifico.nome;
              console.log(`✅ Agente ${isIALigacao ? 'Pri(Ligação)' : 'Pri - Whatsapp'} encontrado:`, agenteEspecifico.nome);
            }

            // Log defensivo para facilitar debug
            if (!telefonePri) {
              const nomeAgenteEsperado = isIALigacao ? 'Pri(Ligação)' : 'Pri - Whatsapp';
              console.warn(`⚠️ Agente ${nomeAgenteEsperado} não encontrado para empresa`, activeCompany.id, {
                tipoIA,
                totalVinculos: (agentesVinculados || []).length,
                totalAgentesAtivos: agentes.length,
                agentesDisponiveis: agentes.map((a: any) => a?.nome),
              });
            }
            
            // Pegar event_id_pri da prospecção
            const eventIdPri = prospeccaoData?.event_id_pri || '';
            
            console.log(`📤 Dados do Agente (${tipoIA}):`, { 
              telefone_pri: telefonePri,
              nome_agente: nomeAgente,
              event_id_pri: eventIdPri,
              dealer_id: empresaData?.crm_id,
              total_leads: data.length
            });

            // Determinar webhook correto baseado no tipo de IA
            const webhookUrl = isIALigacao 
              ? 'https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos-saga-one'
              : 'https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-leads-pri';
            
            // Função para enviar um lead individual
            const enviarLeadPri = async (contato: typeof data[0]) => {
              const payload = {
                // Dados do lead
                id: contato.id,
                lead_id: contato.lead_id,
                nome: contato.nome,
                telefone: normalizePhone(contato.telefone),
                email: contato.email || '',
                status: contato.status || 'Novo',
                origem: contato.origem || 'Importação',
                
                // Dados do evento/prospecção
                prospeccao_id: prospeccaoId,
                evento_nome: prospeccaoData?.titulo || '',
                event_id_pri: eventIdPri,
                data_inicio: prospeccaoData?.data_inicio || null,
                data_fim: prospeccaoData?.data_fim || null,
                canal: prospeccaoData?.canal || (isIALigacao ? 'Ligação' : 'Whatsapp'),
                
                // Dados do agente
                telefone_pri: telefonePri,
                pri_telefone: telefonePri, // Alias para compatibilidade
                nome_agente: nomeAgente,
                dealer_id: empresaData?.crm_id || '',
                pri_dealer_id: empresaData?.crm_id || '', // Alias para compatibilidade
                
                // Dados da loja
                empresa_id: activeCompany.id,
                nome_empresa: empresaData?.nome_empresa || '',
                uf: empresaData?.uf || '',
                cidade: empresaData?.cidade || '',
                
                // Metadados
                data_importacao: new Date().toISOString(),
                tipo_importacao: 'planilha',
                tipo_ia: tipoIA,
                acao: 'criar' // Para o webhook de IA Ligação
              };
              
              try {
                const response = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                  console.error(`❌ Erro ao enviar lead ${contato.nome} para ${tipoIA}:`, response.status);
                }
              } catch (err) {
                console.error(`❌ Erro ao enviar lead ${contato.nome} para ${tipoIA}:`, err);
              }
            };
            
            // Processar em batches de 20 para performance
            const PRI_BATCH_SIZE = 20;
            for (let i = 0; i < data.length; i += PRI_BATCH_SIZE) {
              const batch = data.slice(i, i + PRI_BATCH_SIZE);
              console.log(`📦 Enviando batch ${tipoIA} ${Math.floor(i / PRI_BATCH_SIZE) + 1}/${Math.ceil(data.length / PRI_BATCH_SIZE)} (${batch.length} leads)`);
              
              await Promise.all(batch.map(enviarLeadPri));
            }
            
            console.log(`✅ Todos os leads enviados para ${tipoIA}`);
          } catch (priError) {
            console.error(`❌ Erro ao chamar webhook ${isIALigacao ? 'IA Ligação' : 'recebe-leads-pri'}:`, priError);
            // Não bloqueia o fluxo principal
          }
        }
      }
      // Leads sem prospecção NÃO disparam webhook de status
      
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

  // Excluir múltiplos contatos de uma vez (otimizado para lotes)
  const excluirContatosEmMassa = async (contatoIds: string[]): Promise<{ sucesso: number; falha: number }> => {
    if (contatoIds.length === 0) {
      return { sucesso: 0, falha: 0 };
    }

    let sucesso = 0;
    let falha = 0;

    // Processar em lotes de 100 para evitar timeout
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    
    for (let i = 0; i < contatoIds.length; i += BATCH_SIZE) {
      batches.push(contatoIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`🗑️ Excluindo ${contatoIds.length} contatos em ${batches.length} lotes`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        console.log(`📦 Processando lote ${i + 1}/${batches.length} (${batch.length} contatos)`);
        
        // Usar .in() para deletar múltiplos registros de uma vez
        const { error, count } = await supabase
          .from('contatos')
          .delete()
          .in('id', batch);
        
        if (error) {
          console.error(`❌ Erro no lote ${i + 1}:`, error);
          falha += batch.length;
        } else {
          sucesso += batch.length;
          console.log(`✅ Lote ${i + 1} concluído: ${batch.length} contatos excluídos`);
        }
      } catch (error) {
        console.error(`❌ Exceção no lote ${i + 1}:`, error);
        falha += batch.length;
      }
    }

    // Atualizar estado local removendo os contatos excluídos
    if (sucesso > 0) {
      setContatos(prev => prev.filter(c => !contatoIds.includes(c.id)));
    }

    console.log(`🏁 Exclusão em massa concluída: ${sucesso} sucesso, ${falha} falha`);
    return { sucesso, falha };
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
    atribuirResponsavel,
    getMetricas,
    updateDateFilter,
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    reenviarGatilhos,
    refetch: () => {
      fetchProspeccoes();
      fetchContatos();
    }
  };
};
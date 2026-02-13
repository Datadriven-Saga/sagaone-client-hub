import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhooks para diferentes operações (exclusão removida intencionalmente)
const WEBHOOK_CRIAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-evento-ligacao';
const WEBHOOK_ATUALIZAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-evento-ligacao';
const WEBHOOK_VERIFICA = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';

// Telefone padrão da Pri (fallback caso não encontre no banco)
const TELEFONE_PRI_DEFAULT = '6223980043';

interface EventoInput {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  canal: string;
  evento_principal: boolean;
  qualificar_lead: boolean;
  imagem_divulgacao_url: string | null;
  // Localização específica do evento
  uf: string | null;
  cidade: string | null;
  endereco: string | null;
  // ID numérico do evento (gerado automaticamente)
  id_evento?: number;
}

interface ContatoInput {
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
}

interface EmpresaData {
  id: string;
  nome_empresa: string;
  cnpj: string;
  crm_id: string | null;
  uf: string | null;
  marca: string | null;
  cidade: string | null;
  endereco: string | null;
}

interface AgenteData {
  telefone: string | null;
  dealer_id: string | null;
  nome: string;
}

// Busca o próximo id_evento via webhook externo
async function buscarProximoIdEvento(): Promise<number> {
  try {
    console.log('🔍 Consultando webhook verifica-eventos...');
    
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    
    const response = await fetch(WEBHOOK_VERIFICA, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
    });

    if (!response.ok) {
      console.error('❌ Erro ao consultar verifica-eventos:', response.status);
      throw new Error(`Webhook retornou status ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 Resposta verifica-eventos:', JSON.stringify(data));

    // Espera-se que o webhook retorne o último ID usado ou o próximo ID
    // Adaptando para diferentes formatos de resposta
    let ultimoId = 0;
    
    if (typeof data === 'number') {
      ultimoId = data;
    } else if (data.ultimo_id !== undefined) {
      ultimoId = parseInt(data.ultimo_id, 10);
    } else if (data.proximo_id !== undefined) {
      // Se já retorna o próximo, retornar diretamente
      return parseInt(data.proximo_id, 10);
    } else if (data.id_evento !== undefined) {
      ultimoId = parseInt(data.id_evento, 10);
    } else if (data.last_id !== undefined) {
      ultimoId = parseInt(data.last_id, 10);
    } else if (Array.isArray(data) && data.length > 0) {
      // Se retorna array de eventos, pegar o maior ID
      for (const item of data) {
        const id = parseInt(item.id_evento || item.id || 0, 10);
        if (!isNaN(id) && id > ultimoId) {
          ultimoId = id;
        }
      }
    }

    const proximoId = ultimoId + 1;
    console.log('🔢 Último ID:', ultimoId, '-> Próximo ID:', proximoId);
    
    return proximoId;
  } catch (err) {
    console.error('❌ Erro ao buscar próximo ID via webhook:', err);
    throw new Error('Não foi possível obter o próximo ID do evento. Tente novamente.');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { evento, contatos, empresa_id, acao, agente_template } = body as {
      evento: EventoInput;
      contatos?: ContatoInput[];
      empresa_id: string;
      acao?: 'criar' | 'atualizar' | 'deletar' | 'ativar' | 'desativar';
      agente_template?: { telefone: string; dealer_id: string; nome: string } | null;
    };

    // Determinar qual ação executar (padrão: criar)
    // 'ativar' e 'desativar' são mapeados para 'atualizar' com status diferente
    const operacao = acao === 'ativar' || acao === 'desativar' ? 'atualizar' : (acao || 'criar');
    const statusEvento = acao === 'desativar' ? 'inativo' : 'ativo';

    console.log('📞 IA Ligação Webhook - Operação:', operacao);
    console.log('📞 Evento:', evento?.titulo);
    console.log('📞 Total contatos:', contatos?.length || 0);
    console.log('📞 Agente do template recebido:', agente_template);

    // Buscar dados completos da empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome_empresa, cnpj, crm_id, uf, marca, cidade, endereco')
      .eq('id', empresa_id)
      .single();

    if (empresaError) {
      console.error('❌ Erro ao buscar empresa:', empresaError);
    }

    const empresa = empresaData as EmpresaData | null;

    // Dealer ID SEMPRE vem do crm_id da empresa (OBRIGATÓRIO)
    const dealerId = (empresa?.crm_id || '').trim();
    if (!dealerId) {
      console.error('❌ crm_id da empresa está vazio - bloqueando operação:', empresa_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'crm_id da loja não configurado. Preencha o crm_id da empresa antes de criar/atualizar o evento.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Para IA Ligação precisamos de DOIS agentes:
    // 1. Pri(Ligação) → telefone_pri (para ligações)
    // 2. Pri - WhatsApp → telefone_pri_whatsapp (para WhatsApp)
    let telefonePriLigacao = '';
    let telefonePriWhatsapp = '';
    let fontePriLigacao = '';
    let fontePriWhatsapp = '';

    console.log('🔍 Canal do evento:', evento?.canal, '| Buscando agentes Pri(Ligação) e Pri - WhatsApp');

    // Buscar TODOS os agentes vinculados à empresa
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
      .eq('empresa_id', empresa_id);

    if (agentesVinculadosErr) {
      console.error('⚠️ Erro ao buscar agente_empresas:', agentesVinculadosErr);
    }

    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo)
      .filter((a: any, idx: number, self: any[]) => idx === self.findIndex(t => t?.id === a?.id));

    console.log('📋 Agentes vinculados encontrados:', agentes.map((a: any) => ({ nome: a?.nome, telefone: a?.telefone })));

    // Buscar Pri(Ligação)
    const searchPatternsLigacao = ['pri(ligação)', 'pri(ligacao)', 'pri - ligação', 'pri - ligacao', 'pri ligação', 'pri ligacao'];
    const agentePriLigacao = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return searchPatternsLigacao.some(pattern => nome.includes(pattern)) && a?.telefone;
    });

    if (agentePriLigacao?.telefone) {
      telefonePriLigacao = agentePriLigacao.telefone.replace(/\D/g, '');
      fontePriLigacao = 'db_pri_ligacao';
      console.log('✅ Agente Pri(Ligação) encontrado:', agentePriLigacao.nome, '| Tel:', telefonePriLigacao);
    }

    // Buscar Pri - WhatsApp
    const searchPatternsWhatsapp = ['pri - whatsapp', 'pri whatsapp', 'pri-whatsapp'];
    const agentePriWhatsapp = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return searchPatternsWhatsapp.some(pattern => nome.includes(pattern)) && a?.telefone;
    });

    if (agentePriWhatsapp?.telefone) {
      telefonePriWhatsapp = agentePriWhatsapp.telefone.replace(/\D/g, '');
      fontePriWhatsapp = 'db_pri_whatsapp';
      console.log('✅ Agente Pri - WhatsApp encontrado:', agentePriWhatsapp.nome, '| Tel:', telefonePriWhatsapp);
    }

    // Validar: Pri(Ligação) é obrigatório para IA Ligação
    if (!telefonePriLigacao) {
      console.error('❌ Telefone Pri(Ligação) não encontrado - bloqueando operação:', empresa_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Agente "Pri(Ligação)" não encontrado (ou sem telefone). Configure o agente na loja antes de criar/atualizar o evento.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 Telefone Pri(Ligação) definido:', telefonePriLigacao, '| fonte:', fontePriLigacao);
    console.log('📱 Telefone Pri - WhatsApp definido:', telefonePriWhatsapp || '(não configurado)', '| fonte:', fontePriWhatsapp || 'N/A');
    console.log('🏪 Dealer ID (crm_id) definido:', dealerId);

    const formatarDataISO = (data: string | null): string => {
      if (!data) return '';
      try {
        if (data.includes('T')) {
          return new Date(data).toISOString();
        }
        return new Date(data + 'T11:00:00.000Z').toISOString();
      } catch {
        return '';
      }
    };

    const now = new Date().toISOString();

    // Gerar ou usar id_evento numérico
    let idEvento: number | undefined = evento.id_evento;
    
    // Para criação, o ID já deve vir do frontend (verificado via webhook verifica-eventos)
    // Se não veio, tentar buscar como fallback
    if (operacao === 'criar' && !idEvento) {
      console.log('⚠️ ID do evento não fornecido pelo frontend, buscando via webhook...');
      idEvento = await buscarProximoIdEvento();
      console.log('🔢 ID Evento obtido via webhook (fallback):', idEvento);
    } else if (operacao === 'criar' && idEvento) {
      console.log('✅ ID Evento recebido do frontend:', idEvento);
    }
    
    // Para atualização/exclusão, buscar o ID existente se não fornecido
    if ((operacao === 'atualizar' || operacao === 'deletar') && !idEvento && evento.id) {
      const { data: prospData } = await supabase
        .from('prospeccoes')
        .select('event_id_pri')
        .eq('id', evento.id)
        .single();
      
      if (prospData?.event_id_pri) {
        idEvento = parseInt(prospData.event_id_pri, 10);
        console.log('🔢 ID Evento existente:', idEvento);
      }
    }

    // Payload do evento no formato EXATO solicitado pelo usuário
    const eventoPayload = {
      id_evento: idEvento,
      nome: evento.titulo || '',
      descricao: evento.descricao || '',
      categoria: 'evento',
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePriLigacao,
      telefone_pri_whatsapp: telefonePriWhatsapp,
      pri_dealer_id: dealerId,
      uf: evento.uf || empresa?.uf || '',
      cidade: evento.cidade || empresa?.cidade || '',
      endereco: evento.endereco || empresa?.endereco || '',
      data_inicio: formatarDataISO(evento.data_inicio),
      data_fim: formatarDataISO(evento.data_fim),
      evt_status: statusEvento,
      criado_em: now,
      atualizado_em: now,
    };

    // Payload completo no formato EXATO solicitado: { evento: {...} }
    const payload = {
      evento: eventoPayload,
    };

    // Selecionar webhook baseado na operação
    let webhookUrl: string;
    switch (operacao) {
      case 'atualizar':
        webhookUrl = WEBHOOK_ATUALIZAR;
        break;
      case 'deletar':
        webhookUrl = WEBHOOK_DELETAR;
        break;
      default:
        webhookUrl = WEBHOOK_CRIAR;
    }

    console.log('📤 Enviando para:', webhookUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('✅ Resposta:', response.status, responseText);

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // =====================================================
    // BACKUP: Salvar/atualizar na tabela eventos_pri_voz
    // =====================================================
    if (response.ok && idEvento) {
      try {
        console.log('💾 Salvando backup em eventos_pri_voz...');
        
        const backupData = {
          id_evento: idEvento,
          nome: evento.titulo || '',
          descricao: evento.descricao || null,
          categoria: 'evento',
          marca: empresa?.marca || empresa?.nome_empresa || '',
          dealerid: dealerId,
          telefone_pri: telefonePriLigacao,
          telefone_pri_whatsapp: telefonePriWhatsapp || null,
          uf: evento.uf || empresa?.uf || null,
          cidade: evento.cidade || empresa?.cidade || null,
          endereco: evento.endereco || empresa?.endereco || null,
          data_inicio: evento.data_inicio ? new Date(evento.data_inicio).toISOString() : null,
          data_fim: evento.data_fim ? new Date(evento.data_fim).toISOString() : null,
          evt_status: statusEvento,
          empresa_id: empresa_id,
          atualizado_em: new Date().toISOString(),
        };

        if (operacao === 'criar') {
          // Inserir novo registro
          const { error: insertError } = await supabase
            .from('eventos_pri_voz')
            .insert({
              ...backupData,
              criado_em: new Date().toISOString(),
            });

          if (insertError) {
            console.error('⚠️ Erro ao inserir backup eventos_pri_voz:', insertError);
          } else {
            console.log('✅ Backup criado em eventos_pri_voz');
          }
        } else if (operacao === 'atualizar' || operacao === 'deletar') {
          // Atualizar registro existente (upsert por id_evento)
          const { error: upsertError } = await supabase
            .from('eventos_pri_voz')
            .upsert(backupData, { onConflict: 'id_evento' });

          if (upsertError) {
            console.error('⚠️ Erro ao atualizar backup eventos_pri_voz:', upsertError);
          } else {
            console.log('✅ Backup atualizado em eventos_pri_voz');
          }
        }
      } catch (backupError) {
        console.error('⚠️ Erro no backup eventos_pri_voz (não crítico):', backupError);
        // Não falhar a operação principal por erro de backup
      }
    }

    // =====================================================
    // CHAMAR verifica_eventos_id após criação bem-sucedida
    // =====================================================
    if (response.ok && idEvento && operacao === 'criar') {
      try {
        const VERIFICA_EVENTOS_ID_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica_eventos_id';
        console.log('📡 Chamando verifica_eventos_id com:', { telefone_pri: telefonePriLigacao, id_evento: idEvento });

        const verificaResponse = await fetch(VERIFICA_EVENTOS_ID_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify({
            telefone_pri: telefonePriLigacao,
            id_evento: idEvento,
          }),
        });

        const verificaText = await verificaResponse.text();
        console.log(`✅ verifica_eventos_id resposta (${verificaResponse.status}):`, verificaText.substring(0, 500));
      } catch (verificaError) {
        console.error('⚠️ Erro ao chamar verifica_eventos_id (não crítico):', verificaError);
      }
    }

    // Se a criação foi bem-sucedida, retornar o id_evento para ser salvo
    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        url: webhookUrl,
        data: responseData,
        id_evento: idEvento,
        acao: operacao,
        payload_enviado: payload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no IA Ligação Webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

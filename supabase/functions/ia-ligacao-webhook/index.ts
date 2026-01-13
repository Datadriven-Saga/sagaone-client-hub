import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhooks para diferentes operações
const WEBHOOK_CRIAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/configura-eventos-saga-one';
const WEBHOOK_ATUALIZAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-eventos-saga-one';
const WEBHOOK_DELETAR = 'https://automatemaiawh.sagadatadriven.com.br/webhook/deleta-eventos-saga-one';
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
    
    const response = await fetch(WEBHOOK_VERIFICA, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
      acao?: 'criar' | 'atualizar' | 'deletar';
      agente_template?: { telefone: string; dealer_id: string; nome: string } | null;
    };

    // Determinar qual ação executar (padrão: criar)
    const operacao = acao || 'criar';

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

    // PRIORIDADE 1: Usar dados do agente do template (se passados pelo frontend)
    let telefonePri = '';
    let dealerId = '';

    if (agente_template?.telefone) {
      console.log('✅ Usando dados do agente do template (prioridade)');
      telefonePri = agente_template.telefone.replace(/\D/g, '');
      dealerId = agente_template.dealer_id || empresa?.crm_id || '';
      console.log('📱 Telefone Pri (do template):', telefonePri);
      console.log('🏪 Dealer ID (do template):', dealerId);
    } else {
      // PRIORIDADE 2: Buscar agente "Pri" da empresa (fallback)
      console.log('⚠️ Agente do template não fornecido, buscando Pri da empresa...');
      
      const { data: priData, error: priError } = await supabase
        .from('agentes_ia')
        .select('telefone, dealer_id, nome')
        .eq('empresa_id', empresa_id)
        .ilike('nome', '%pri%')
        .eq('ativo', true)
        .limit(1)
        .single();

      if (priError) {
        console.log('⚠️ Agente Pri não encontrado, usando fallback:', priError.message);
      }

      const agentePri = priData as AgenteData | null;

      // Se não encontrou Pri, buscar qualquer agente ativo da empresa
      let agenteBackup: AgenteData | null = null;
      if (!agentePri) {
        const { data: backupData } = await supabase
          .from('agentes_ia')
          .select('telefone, dealer_id, nome')
          .eq('empresa_id', empresa_id)
          .eq('ativo', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        agenteBackup = backupData as AgenteData | null;
      }

      // Usar dados da Pri ou fallback
      const agente = agentePri || agenteBackup;
      
      // Telefone da Pri: do agente Pri > de qualquer agente > default
      telefonePri = agentePri?.telefone?.replace(/\D/g, '') || 
                    agenteBackup?.telefone?.replace(/\D/g, '') || 
                    TELEFONE_PRI_DEFAULT;

      // Dealer ID: do agente > crm_id da empresa
      dealerId = agente?.dealer_id || empresa?.crm_id || '';
      
      console.log('📱 Telefone Pri (fallback):', telefonePri);
      console.log('🏪 Dealer ID (fallback):', dealerId);
    }

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

    // Payload do evento no formato esperado pelo agente
    const eventoPayload = {
      id_evento: idEvento,
      nome: evento.titulo || '',
      descricao: evento.descricao || '',
      categoria: 'evento',
      marca: empresa?.marca || empresa?.nome_empresa || '',
      dealerid: dealerId,
      telefone_pri: telefonePri,
      uf: evento.uf || empresa?.uf || '',
      cidade: evento.cidade || empresa?.cidade || '',
      endereco: evento.endereco || empresa?.endereco || '',
      data_inicio: formatarDataISO(evento.data_inicio),
      data_fim: formatarDataISO(evento.data_fim),
      evt_status: operacao === 'deletar' ? 'inativo' : 'ativo',
      criado_em: now,
      atualizado_em: now,
    };

    // Payload dos contatos no formato esperado
    const contatosPayload = (contatos || []).map((c: ContatoInput) => ({
      nome: c.nome || '',
      telefone: c.telefone || '',
      loja: empresa?.nome_empresa || '',
    }));

    // Payload completo
    const payload = {
      ...eventoPayload,
      clientes: contatosPayload,
      evento: eventoPayload,
      contatos: contatosPayload,
      total_clientes: contatosPayload.length,
      total_contatos: contatosPayload.length,
      timestamp: now,
      acao: operacao,
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
    console.log('📦 Payload:', JSON.stringify({
      id_evento: payload.id_evento,
      nome: payload.nome,
      dealerid: payload.dealerid,
      telefone_pri: payload.telefone_pri,
      uf: payload.uf,
      cidade: payload.cidade,
      total_clientes: payload.total_clientes,
      acao: payload.acao,
    }, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // Se a criação foi bem-sucedida, retornar o id_evento para ser salvo
    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        url: webhookUrl,
        data: responseData,
        id_evento: idEvento,
        total_contatos: contatosPayload.length,
        acao: operacao,
        payload_preview: {
          id_evento: payload.id_evento,
          nome: payload.nome,
          dealerid: payload.dealerid,
          telefone_pri: payload.telefone_pri,
          uf: payload.uf,
          cidade: payload.cidade,
          endereco: payload.endereco,
          total_clientes: payload.total_clientes,
        },
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

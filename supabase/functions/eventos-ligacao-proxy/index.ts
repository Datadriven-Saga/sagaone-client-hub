const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Timeout de 8 segundos para evitar travamento
const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    
    const { action, ...params } = await req.json();

    let webhookUrl: string;
    let body: Record<string, any>;

    console.log(`🔄 Action recebida: ${action}`, params);

    switch (action) {
      case 'listar_todos':
        // Nova action para a tela de Eventos do Agente - apenas telefone_pri
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos-pri';
        body = {
          telefone_pri: params.telefone_pri,
        };
        console.log(`📞 Buscando eventos para telefone_pri: ${params.telefone_pri}`);
        break;

      case 'listar':
        // Action original que usa telefone_pri e dealerid
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';
        body = {
          telefone_pri: params.telefone_pri,
          dealer_id: params.dealer_id,
        };
        break;

      case 'mudar_status':
        // Webhook diferente para ativar ou desativar
        if (params.evt_status === true) {
          webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/ativa-evento';
        } else {
          webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/desativa-evento';
        }
        body = {
          id_evento: params.id_evento,
          telefone_pri: params.telefone_pri,
        };
        break;

      case 'deletar':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/deleta-eventos-saga-one';
        body = {
          id_evento: params.id_evento,
        };
        break;

      case 'listar_geral':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/eventos-pri';
        body = {
          telefone_pri: params.telefone_pri,
        };
        break;

      case 'buscar_contatos':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos';
        body = {
          telefone_pri: params.telefone_pri,
          id_evento: params.id_evento,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Chamando webhook ${action}:`, webhookUrl, body);

    const webhookHeaders = {
      'Content-Type': 'application/json',
      ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
    };

    const buildGetUrl = (baseUrl: string, payload: Record<string, any>) => {
      const url = new URL(baseUrl);
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined && v !== null && String(v).length > 0) {
          url.searchParams.set(k, String(v));
        }
      }
      return url.toString();
    };

    const doPost = async () => {
      return await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify(body),
      });
    };

    const doGet = async () => {
      return await fetchWithTimeout(buildGetUrl(webhookUrl, body), {
        method: 'GET',
        headers: SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {},
      });
    };

    // Actions que tentam POST primeiro
    const tryPostFirst = action === 'listar' || action === 'listar_geral' || action === 'buscar_contatos';

    let response = await doPost();
    let responseText = await response.text();

    if (
      tryPostFirst &&
      response.status === 404 &&
      responseText.toLowerCase().includes('not registered for post')
    ) {
      console.log('Webhook parece exigir GET; tentando novamente via GET...');
      response = await doGet();
      responseText = await response.text();
    }

    console.log(`Resposta do webhook (${response.status}):`, responseText.substring(0, 500));
    
    // Tenta parsear como JSON, se falhar retorna como texto
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro no proxy:', error);
    
    // Verificar se é timeout
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          error: 'Timeout ao buscar dados do servidor externo',
          eventos: [] 
        }),
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

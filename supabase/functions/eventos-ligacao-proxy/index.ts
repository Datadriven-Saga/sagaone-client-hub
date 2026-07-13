import { resolveWebhookBySlug, buildAuthHeaders, markWebhookUsed, type WebhookConfig } from "../_shared/webhook-registry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Timeout de 8 segundos para evitar travamento
const FETCH_TIMEOUT = 8000;

const ACTION_WEBHOOK_SLUGS: Record<string, string> = {
  listar_todos: 'pri_voz.eventos.list_all',
  listar: 'pri_voz.eventos.list',
  deletar: 'pri_voz.eventos.deleta',
  listar_geral: 'pri_voz.eventos.eventos_pri',
  buscar_contatos: 'pri_voz.contatos.verifica',
};

async function getWebhook(slug: string): Promise<WebhookConfig> {
  const cfg = await resolveWebhookBySlug(slug);
  if (!cfg?.url) throw new Error(`Webhook "${slug}" não cadastrado em Administração → Webhooks.`);
  if (!cfg.ativo) throw new Error(`Webhook "${slug}" está desativado em Administração → Webhooks.`);
  return cfg;
}

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
    const { action, ...params } = await req.json();

    let webhookSlug: string;
    let body: Record<string, any>;

    console.log(`🔄 Action recebida: ${action}`, params);

    switch (action) {
      case 'listar_todos':
        // Nova action para a tela de Eventos do Agente - apenas telefone_pri
        webhookSlug = ACTION_WEBHOOK_SLUGS.listar_todos;
        body = {
          telefone_pri: params.telefone_pri,
        };
        console.log(`📞 Buscando eventos para telefone_pri: ${params.telefone_pri}`);
        break;

      case 'listar':
        // Action original que usa telefone_pri e dealerid
        webhookSlug = ACTION_WEBHOOK_SLUGS.listar;
        body = {
          telefone_pri: params.telefone_pri,
          dealer_id: params.dealer_id,
        };
        break;

      case 'mudar_status':
        // Webhook diferente para ativar ou desativar
        if (params.evt_status === true) {
          webhookSlug = 'pri_voz.eventos.ativa';
        } else {
          webhookSlug = 'pri_voz.eventos.desativa';
        }
        body = {
          id_evento: params.id_evento,
          telefone_pri: params.telefone_pri,
        };
        break;

      case 'deletar':
        webhookSlug = ACTION_WEBHOOK_SLUGS.deletar;
        body = {
          id_evento: params.id_evento,
        };
        break;

      case 'listar_geral':
        webhookSlug = ACTION_WEBHOOK_SLUGS.listar_geral;
        body = {
          telefone_pri: params.telefone_pri,
        };
        break;

      case 'buscar_contatos':
        webhookSlug = ACTION_WEBHOOK_SLUGS.buscar_contatos;
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

    const webhookConfig = await getWebhook(webhookSlug);
    const webhookUrl = webhookConfig.url;

    console.log(`Chamando webhook ${action}:`, webhookUrl, body);

    const webhookHeaders = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(webhookConfig),
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
        headers: buildAuthHeaders(webhookConfig),
      });
    };

    // Actions que tentam POST primeiro
    const tryPostFirst = action === 'listar' || action === 'listar_geral' || action === 'buscar_contatos';

    let response = await doPost();
    let responseText = await response.text();
    void markWebhookUsed(webhookSlug);

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
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    const message = error instanceof Error ? error.message : 'Erro interno';

    if (isAbortError) {
      return new Response(
        JSON.stringify({ 
          error: 'Timeout ao buscar dados do servidor externo',
          eventos: [] 
        }),
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

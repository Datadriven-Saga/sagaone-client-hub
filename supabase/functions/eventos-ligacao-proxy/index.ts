import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    
    const { action, ...params } = await req.json();

    let webhookUrl: string;
    let body: Record<string, any>;

    switch (action) {
      case 'listar_todos':
        // Nova action para a tela de Eventos do Agente - apenas telefone_pri
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos-pri';
        body = {
          telefone_pri: params.telefone_pri,
        };
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
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/muda-status-evento';
        body = {
          id_evento: params.id_evento,
          evt_status: params.evt_status,
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

    // N8N pode estar configurado para aceitar GET no "verifica-eventos".
    // Fazemos POST primeiro, e se o endpoint retornar o erro clássico de method mismatch,
    // tentamos novamente via GET usando querystring.
    const tryPostFirst = action === 'listar' || action === 'listar_geral' || action === 'buscar_contatos';

    const buildGetUrl = (baseUrl: string, payload: Record<string, any>) => {
      const url = new URL(baseUrl);
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined && v !== null && String(v).length > 0) {
          url.searchParams.set(k, String(v));
        }
      }
      return url.toString();
    };

    const webhookHeaders = {
      'Content-Type': 'application/json',
      ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
    };

    const doPost = async () => {
      return await fetch(webhookUrl, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify(body),
      });
    };

    const doGet = async () => {
      return await fetch(buildGetUrl(webhookUrl, body), {
        method: 'GET',
        headers: SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {},
      });
    };

    let response = tryPostFirst ? await doPost() : await doPost();
    let responseText = await response.text();

    if (
      tryPostFirst &&
      response.status === 404 &&
      responseText.toLowerCase().includes('not registered for post')
    ) {
      console.log('Webhook listar parece exigir GET; tentando novamente via GET...');
      response = await doGet();
      responseText = await response.text();
    }

    console.log(`Resposta do webhook (${response.status}):`, responseText);
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
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

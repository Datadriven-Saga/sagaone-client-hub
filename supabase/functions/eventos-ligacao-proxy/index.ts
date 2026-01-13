import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let webhookUrl: string;
    let body: Record<string, any>;

    switch (action) {
      case 'listar':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos';
        body = {
          agente_id: params.agente_id,
          telefone: params.telefone,
        };
        break;

      case 'mudar_status':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/muda-status-evento';
        body = {
          id_evento: params.id_evento,
          evt_status: params.evt_status,
        };
        break;

      case 'deletar':
        webhookUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/deleta-eventos-saga-one';
        body = {
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

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
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

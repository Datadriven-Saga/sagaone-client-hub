// External Webhook Proxy - Routes requests to external n8n/PRI endpoints

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de endpoints permitidos para URLs externas
const ALLOWED_ENDPOINTS: Record<string, { url: string; method: 'GET' | 'POST' }> = {
  // Consultas - verifica-eventos usa POST com telefone_pri + dealer_id no body
  'verifica-eventos': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos', method: 'POST' },
  // sincroniza_sagaone para sincronizar contatos do PRI para Supabase
  'sincroniza_sagaone': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/sincroniza_sagaone', method: 'POST' },
  // metricas usa POST para enviar telefone_pri + id_evento no body (retorna dados agregados para tela de métricas)
  'metricas': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/metricas', method: 'POST' },
  'busca-dados-agentes': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-dados-agentes', method: 'GET' },
  'dashboard-evento-pri-whats': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/dashboard-evento-pri-whats', method: 'POST' },
  
  // Ações (POST)
  'verifica-instancias_evo': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', method: 'POST' },
  'atualiza-instancias_evo': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', method: 'POST' },
  'atualiza-agente': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-agente', method: 'POST' },
  'cria-agente': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-agente', method: 'POST' },
  'cria-base-ligacao': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao', method: 'POST' },
  'dispara-ligacao': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao', method: 'POST' },
  'apaga-template-meta': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/apaga-template-meta', method: 'POST' },
  'pri-config': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/pri-config', method: 'POST' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Pegar body do request
    let bodyData: Record<string, any> = {};
    try {
      const text = await req.text();
      if (text) {
        bodyData = JSON.parse(text);
      }
    } catch {
      // Body vazio ou inválido
    }
    
    // Pegar o endpoint do body
    const endpoint = bodyData.endpoint;
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "endpoint" é obrigatório no body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpointConfig = ALLOWED_ENDPOINTS[endpoint];
    if (!endpointConfig) {
      return new Response(
        JSON.stringify({ error: `Endpoint "${endpoint}" não permitido. Endpoints válidos: ${Object.keys(ALLOWED_ENDPOINTS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter token SAGA_ONE para autenticação
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

    // Construir URL com query params para GET
    const externalUrl = new URL(endpointConfig.url);
    
    // Preparar body para POST (excluindo 'endpoint')
    const postBody: Record<string, any> = {};
    for (const [key, value] of Object.entries(bodyData)) {
      if (key !== 'endpoint') {
        if (endpointConfig.method === 'GET' && value !== undefined && value !== null) {
          externalUrl.searchParams.set(key, String(value));
        } else if (endpointConfig.method === 'POST') {
          // Para verifica-eventos, enviar apenas telefone_pri e dealer_id
          if (endpoint === 'verifica-eventos') {
            if (key === 'telefone_pri') {
              postBody['telefone_pri'] = value;
            }
            if (key === 'dealer_id' || key === 'dealerid') {
              postBody['dealer_id'] = value;
            }
          } else {
            postBody[key] = value;
          }
        }
      }
    }

    console.log(`🔗 Proxy ${endpointConfig.method} to: ${externalUrl.toString()}`);
    if (endpointConfig.method === 'POST') {
      console.log('📦 Body:', JSON.stringify(postBody));
    }

    const fetchOptions: RequestInit = {
      method: endpointConfig.method,
      headers: {
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
    };

    if (endpointConfig.method === 'POST') {
      fetchOptions.body = JSON.stringify(postBody);
    }

    const response = await fetch(externalUrl.toString(), fetchOptions);

    const responseText = await response.text();
    console.log('✅ Response status:', response.status);
    console.log(
      '📥 Response body:',
      responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
    );

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro no external-webhook-proxy:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

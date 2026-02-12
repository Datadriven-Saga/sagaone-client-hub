// External Webhook Proxy - Routes requests to external n8n/PRI endpoints

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Mapeamento de endpoints permitidos para URLs externas
const ALLOWED_ENDPOINTS: Record<string, { url: string; method: 'GET' | 'POST' }> = {
  'verifica-eventos': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos', method: 'POST' },
  'verifica-todos-eventos-pri': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos-pri', method: 'POST' },
  'sincroniza_sagaone': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/sincroniza_sagaone', method: 'POST' },
  'metricas': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/metricas', method: 'POST' },
  'busca-dados-agentes': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-dados-agentes', method: 'GET' },
  'dashboard-evento-pri-whats': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/dashboard-evento-pri-whats', method: 'POST' },
  'verifica-instancias_evo': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', method: 'POST' },
  'atualiza-instancias_evo': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', method: 'POST' },
  'atualiza-agente': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-agente', method: 'POST' },
  'cria-agente': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-agente', method: 'POST' },
  'cria-base-ligacao': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao', method: 'POST' },
  'dispara-ligacao': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao', method: 'POST' },
  'apaga-template-meta': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/apaga-template-meta', method: 'POST' },
  'verifica-templates': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-templates', method: 'POST' },
  'pri-config': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/pri-config', method: 'POST' },
  'insere-loja': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/insere-loja', method: 'POST' },
  'verifca-lojas': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifca-lojas', method: 'GET' },
  'update-lojas-gaia': { url: 'https://automatemaiawh.sagadatadriven.com.br/webhook/update-lojas-gaia', method: 'POST' },
};

// Domínios permitidos para webhook genérico (passthrough)
const ALLOWED_DOMAINS = [
  'automatemaiawh.sagadatadriven.com.br',
  'automatemaia.sagadatadriven.com.br',
];

function isAllowedGenericUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Apenas HTTPS é permitido' };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return { valid: false, error: `Domínio "${hostname}" não permitido` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'URL inválida' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let bodyData: Record<string, any> = {};
    try {
      const text = await req.text();
      if (text) {
        bodyData = JSON.parse(text);
      }
    } catch {
      // Body vazio ou inválido
    }

    const endpoint = bodyData.endpoint;
    const genericWebhookUrl = bodyData.webhook_url;

    // Obter token SAGA_ONE para autenticação
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';

    // ============ MODO GENÉRICO (webhook_url dinâmico) ============
    if (genericWebhookUrl) {
      const urlCheck = isAllowedGenericUrl(genericWebhookUrl);
      if (!urlCheck.valid) {
        console.error(`❌ URL bloqueada no proxy genérico: ${urlCheck.error} - ${genericWebhookUrl}`);
        return new Response(
          JSON.stringify({ error: urlCheck.error }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remover campos de controle do body
      const { endpoint: _e, webhook_url: _w, webhook_method: method, ...payload } = bodyData;
      const httpMethod = (method || 'POST').toUpperCase();

      console.log(`🔗 Proxy genérico ${httpMethod} → ${genericWebhookUrl}`);
      console.log('📦 Body:', JSON.stringify(payload).substring(0, 500));

      const fetchOptions: RequestInit = {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
        },
      };
      if (httpMethod === 'POST' || httpMethod === 'PUT') {
        fetchOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(genericWebhookUrl, fetchOptions);
      const responseText = await response.text();
      console.log(`✅ Proxy genérico resposta (${response.status}):`, responseText.substring(0, 500));

      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      // Sempre retorna 200 para o cliente, encapsulando o status original
      return new Response(
        JSON.stringify({ data: responseData, upstream_status: response.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ MODO ENDPOINT FIXO ============
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "endpoint" ou "webhook_url" é obrigatório no body' }),
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

    const externalUrl = new URL(endpointConfig.url);
    const postBody: Record<string, any> = {};
    for (const [key, value] of Object.entries(bodyData)) {
      if (key !== 'endpoint') {
        if (endpointConfig.method === 'GET' && value !== undefined && value !== null) {
          externalUrl.searchParams.set(key, String(value));
        } else if (endpointConfig.method === 'POST') {
          if (endpoint === 'verifica-eventos') {
            if (key === 'telefone_pri') postBody['telefone_pri'] = value;
            if (key === 'dealer_id' || key === 'dealerid') postBody['dealer_id'] = value;
          } else if (endpoint === 'verifica-todos-eventos-pri') {
            if (key === 'telefone_pri') postBody['telefone_pri'] = value;
          } else {
            postBody[key] = value;
          }
        }
      }
    }

    console.log(`🔗 Proxy ${endpointConfig.method} → ${externalUrl.toString()}`);
    if (endpointConfig.method === 'POST') {
      console.log('📦 Body:', JSON.stringify(postBody).substring(0, 500));
    }

    const fetchOptions: RequestInit = {
      method: endpointConfig.method,
      headers: {
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
    };

    if (endpointConfig.method === 'POST') {
      if (endpoint === 'insere-loja' || endpoint === 'update-lojas-gaia') {
        fetchOptions.body = JSON.stringify([postBody]);
      } else {
        fetchOptions.body = JSON.stringify(postBody);
      }
    }

    // dispara-ligacao: retorno imediato com background task
    if (endpoint === 'dispara-ligacao') {
      const backgroundTask = async () => {
        try {
          const response = await fetch(externalUrl.toString(), fetchOptions);
          const text = await response.text();
          console.log(`✅ dispara-ligacao Response (${response.status}):`, text.substring(0, 500));
        } catch (err) {
          console.error('❌ Erro no dispara-ligacao:', err);
        }
      };
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundTask());
      } else {
        backgroundTask();
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Disparo iniciado com sucesso.', async: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(externalUrl.toString(), fetchOptions);
    const responseText = await response.text();
    console.log(`✅ Response (${response.status}):`, responseText.substring(0, 500));

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Sempre retorna 200 para o cliente, encapsulando o status original
    return new Response(
      JSON.stringify({ data: responseData, upstream_status: response.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

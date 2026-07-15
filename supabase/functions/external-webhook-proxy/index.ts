// External Webhook Proxy - Routes requests to external n8n/PRI endpoints
// URLs are resolved dynamically from public.webhook_registry (managed via
// Administração → Webhooks). No hard-coded endpoint map.

import { resolveWebhookByPathSuffix, resolveWebhookBySlug, buildAuthHeaders, markWebhookUsed, type WebhookConfig } from "../_shared/webhook-registry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Domínios permitidos para webhook genérico (passthrough)
const ALLOWED_DOMAINS = [
  'automatemaiawh.sagadatadriven.com.br',
  'automatemaia.sagadatadriven.com.br',
  'n8n-webhook.sagadatadriven.com.br',
  'execute-api.us-east-1.amazonaws.com',
];

const LEGACY_ENDPOINT_SLUGS: Record<string, string> = {
  'busca_config_pos': 'paty.pos_vendas.busca_config',
  'config_gerais': 'paty.pos_vendas.config_gerais',
  'upsert_ranges': 'paty.pos_vendas.upsert_ranges',
  'altera_status_pos_vendas': 'paty.pos_vendas.altera_status',
  // Paty — Entregas (Saga Conecta)
  'busca-paty-entrega-template': 'paty.entrega.busca_template',
  'upsert-paty-entrega-template': 'paty.entrega.upsert_template',
  'desativa-paty-entrega-template': 'paty.entrega.desativa_template',
  'remove-paty-entrega-template': 'paty.entrega.remove_template',
  // Paty — Peças
  'busca-paty-pecas-template': 'paty.pecas.busca_template',
  'upsert-paty-pecas-template': 'paty.pecas.upsert_template',
  'desativa-paty-pecas-template': 'paty.pecas.desativa_template',
  'busca-paty-pecas-prazo': 'paty.pecas.busca_prazo',
  'upsert-paty-pecas-prazo': 'paty.pecas.upsert_prazo',
  // Paty — Cadência
  'busca-paty-cadencia-config-template': 'paty.cadencia.busca_config_template',
  'upsert-paty-cadencia-config-template': 'paty.cadencia.upsert_config_template',
  'busca-paty-cadencia-steps': 'paty.cadencia.busca_steps',
  'upsert-paty-cadencia-steps': 'paty.cadencia.upsert_steps',
  'delete-paty-cadencia-step': 'paty.cadencia.delete_step',
  // Paty — Lojas
  'busca-paty-lojas-ids': 'paty.lojas.busca_ids',
  'insere-paty-lojas-ids': 'paty.lojas.insere_ids',
  'atualiza-paty-lojas-ids': 'paty.lojas.atualiza_ids',
  // Templates Meta
  'apaga-template-meta': 'pri_wpp.templates.apaga_meta',
  'criar-template-pri-from-meta': 'pri_wpp.templates.criar_from_meta',
  'verifica-templates': 'pri_wpp.templates.verifica',
  'busca-dados-agentes': 'pri_voz.agentes.busca_dados',
  'verifica-eventos': 'pri_voz.eventos.list',
  'verifica-todos-eventos-pri': 'pri_voz.eventos.list_all',
  'eventos-pri': 'pri_voz.eventos.eventos_pri',
  'verifica_eventos_id': 'pri_voz.eventos.verifica_by_id',
  'cria-evento-ligacao': 'pri_voz.eventos.cria_evento',
  'atualiza-evento-ligacao': 'pri_voz.eventos.atualiza_evento',
  'deleta-eventos-saga-one': 'pri_voz.eventos.deleta',
  'ativa-evento': 'pri_voz.eventos.ativa',
  'desativa-evento': 'pri_voz.eventos.desativa',
  'verifica-contatos': 'pri_voz.contatos.verifica',
  'cria-base-ligacao': 'pri_voz.base.cria_base',
  'dispara-ligacao': 'pri_voz.dispara_ligacao',
  'sincroniza_sagaone': 'sistema.sincroniza_sagaone',
  'recebe-status-sagaone': 'sistema.status.recebe_sagaone',
  'cadencia_ligacao': 'pri_voz.cadencia',
  'envia_mensagem': 'pri_wpp.envia_mensagem',
  '8275b29e-b3b1-494d-a604-b285a8cc0d56': 'maia.chat.proxy',
};

function pathKeyFromUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.pathname.split('/').filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

async function resolveRegistryEntry(key: string): Promise<WebhookConfig | null> {
  const trimmed = String(key || '').trim();
  if (!trimmed) return null;
  const directSlug = await resolveWebhookBySlug(trimmed);
  if (directSlug) return directSlug;
  const mappedSlug = LEGACY_ENDPOINT_SLUGS[trimmed];
  if (mappedSlug) return await resolveWebhookBySlug(mappedSlug);
  return await resolveWebhookByPathSuffix(trimmed);
}

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
    // `slug` is frequently a business field in payloads (ex.: slug do gatilho Paty).
    // Only treat it as a webhook selector in the old generic mode where no endpoint/url exists.
    const legacySlugSelector = !endpoint && !genericWebhookUrl ? bodyData.slug : undefined;
    const webhookSlug = bodyData.webhook_slug || legacySlugSelector;

    // ============ MODO GENÉRICO (webhook_url dinâmico) ============
    if (webhookSlug || genericWebhookUrl) {
      const legacyKey = webhookSlug || pathKeyFromUrl(genericWebhookUrl);
      const registryEntry = legacyKey ? await resolveRegistryEntry(String(legacyKey)) : null;
      if (registryEntry && !registryEntry.ativo) {
        return new Response(
          JSON.stringify({ error: `Webhook "${registryEntry.slug || legacyKey}" está desativado em Administração → Webhooks.` }),
          { status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!registryEntry?.url) {
        return new Response(
          JSON.stringify({ error: `Webhook "${legacyKey}" não cadastrado em Administração → Webhooks.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const targetUrl = registryEntry.url;
      const urlCheck = isAllowedGenericUrl(targetUrl);
      if (!urlCheck.valid) {
        console.error(`❌ URL bloqueada no proxy genérico: ${urlCheck.error} - ${targetUrl}`);
        return new Response(
          JSON.stringify({ error: urlCheck.error }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remover apenas campos de controle do body. Mantém `slug` quando ele é dado de negócio.
      const { endpoint: _e, webhook_url: _w, webhook_slug: _s, webhook_method: method, ...payloadWithMaybeSlug } = bodyData;
      const payload = legacySlugSelector ? (() => {
        const { slug: _legacySlug, ...rest } = payloadWithMaybeSlug;
        return rest;
      })() : payloadWithMaybeSlug;
      const httpMethod = (method || registryEntry?.metodo || 'POST').toUpperCase();

      console.log(`🔗 Proxy genérico ${httpMethod} → ${targetUrl}`);
      console.log('📦 Body:', JSON.stringify(payload).substring(0, 500));

      const fetchOptions: RequestInit = {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(registryEntry),
        },
      };
      if (httpMethod === 'POST' || httpMethod === 'PUT') {
        fetchOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const responseText = await response.text();
      console.log(`✅ Proxy genérico resposta (${response.status}):`, responseText.substring(0, 500));
      if (registryEntry?.slug) void markWebhookUsed(registryEntry.slug);

      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      // Sempre retorna 200 para o cliente (evita FunctionsHttpError no SDK)
      return new Response(
        JSON.stringify(responseData),
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

    // Resolve URL dinâmica pelo registry (Administração → Webhooks)
    const registryEntry = await resolveRegistryEntry(endpoint);
    if (!registryEntry || !registryEntry.url) {
      return new Response(
        JSON.stringify({ error: `Endpoint "${endpoint}" não cadastrado em Administração → Webhooks.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!registryEntry.ativo) {
      return new Response(
        JSON.stringify({ error: `Endpoint "${endpoint}" está desativado em Administração → Webhooks.` }),
        { status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const endpointConfig = { url: registryEntry.url, method: (registryEntry.metodo || 'POST') as 'GET' | 'POST' };

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
        ...buildAuthHeaders(registryEntry),
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
      void backgroundTask();
      void markWebhookUsed(registryEntry.slug || endpoint);
      return new Response(
        JSON.stringify({ success: true, message: 'Disparo iniciado com sucesso.', async: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(externalUrl.toString(), fetchOptions);
    const responseText = await response.text();
    console.log(`✅ Response (${response.status}):`, responseText.substring(0, 500));
    void markWebhookUsed(registryEntry.slug || endpoint);

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Sempre retorna 200 para o cliente (evita FunctionsHttpError no SDK)
    return new Response(
      JSON.stringify(responseData),
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

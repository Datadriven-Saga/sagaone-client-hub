import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveWebhookBySlug, resolveWebhookByPathSuffix, buildAuthHeaders, markWebhookUsed } from "../_shared/webhook-registry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    const legacyPath = payload._webhook_url ? String(payload._webhook_url).split('/').pop() : null;
    const webhookConfig = payload._webhook_slug
      ? await resolveWebhookBySlug(String(payload._webhook_slug))
      : legacyPath
        ? await resolveWebhookByPathSuffix(legacyPath)
        : await resolveWebhookBySlug('maia.chat.proxy');

    if (!webhookConfig?.url) {
      return new Response(
        JSON.stringify({ error: 'Webhook não cadastrado em Administração → Webhooks.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!webhookConfig.ativo) {
      return new Response(
        JSON.stringify({ error: `Webhook "${webhookConfig.slug || legacyPath}" está desativado em Administração → Webhooks.` }),
        { status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const targetUrl = webhookConfig.url;
    
    // Remove internal field before forwarding
    const { _webhook_url, _webhook_slug, ...forwardPayload } = payload;
    
    console.log('Proxying webhook request to:', targetUrl);

    const response = await fetch(
      targetUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(webhookConfig),
        },
        body: JSON.stringify(forwardPayload),
      }
    );

    const responseText = await response.text();
    console.log('Webhook response status:', response.status);
    console.log('Webhook response:', responseText);
    if (response.ok && webhookConfig.slug) void markWebhookUsed(webhookConfig.slug);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { 
        status: response.status, 
        statusText: response.statusText,
        body: responseText 
      };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in maia-webhook-proxy:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

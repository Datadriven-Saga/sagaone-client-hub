import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveWebhookBySlug, buildAuthHeaders } from "../_shared/webhook-registry.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const wh = await resolveWebhookBySlug('pri_wpp.disparo');
    if (!wh) return new Response(JSON.stringify({ error: 'slug not found' }), { status: 404, headers: cors });
    const headers = { 'Content-Type': 'application/json', ...buildAuthHeaders(wh) };
    const started = Date.now();
    const r = await fetch(wh.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: true, ping: 'diagnostic', timestamp: new Date().toISOString() }),
    });
    const body = await r.text();
    return new Response(JSON.stringify({
      url: wh.url,
      auth_header: wh.credencial_header,
      secret_name: wh.credencial_secret_name,
      secret_present: !!Deno.env.get(wh.credencial_secret_name || ''),
      status: r.status,
      duration_ms: Date.now() - started,
      body: body.slice(0, 500),
    }, null, 2), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
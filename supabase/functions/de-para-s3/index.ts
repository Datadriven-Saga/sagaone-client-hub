import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PREFIX = "de-para/";

function keyFor(name: string) {
  const safe = name.trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
  if (!safe) throw new Error("Nome inválido");
  return `${PREFIX}${safe}.json`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const REGION = Deno.env.get("AWS_S3_REGION")?.trim();
    const ACCESS_KEY_ID = Deno.env.get("AWS_S3_ACCESS_KEY_ID")?.trim();
    const SECRET_ACCESS_KEY = Deno.env.get("AWS_S3_SECRET_ACCESS_KEY")?.trim();
    const BUCKET = Deno.env.get("AWS_S3_BUCKET")?.trim();
    if (!REGION || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
      throw new Error("Secrets AWS_S3_* não configuradas");
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "debug") {
      return new Response(JSON.stringify({
        region: REGION,
        bucket: BUCKET,
        access_key_id_len: ACCESS_KEY_ID.length,
        access_key_id_preview: ACCESS_KEY_ID.slice(0, 4) + "..." + ACCESS_KEY_ID.slice(-4),
        secret_len: SECRET_ACCESS_KEY.length,
        secret_has_whitespace: /\s/.test(SECRET_ACCESS_KEY),
        secret_first_char_code: SECRET_ACCESS_KEY.charCodeAt(0),
        secret_last_char_code: SECRET_ACCESS_KEY.charCodeAt(SECRET_ACCESS_KEY.length - 1),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aws = new AwsClient({
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      region: REGION,
      service: "s3",
    });

    const base = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

    if (action === "list") {
      const params = new URLSearchParams({ "list-type": "2", prefix: PREFIX, "max-keys": "1000" });
      const res = await aws.fetch(`${base}/?${params}`);
      const xml = await res.text();
      if (!res.ok) throw new Error(`List falhou [${res.status}]: ${xml}`);
      const items: Array<{ name: string; key: string; size: number; lastModified: string }> = [];
      const re = /<Contents>([\s\S]*?)<\/Contents>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const block = m[1];
        const key = (block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? "").trim();
        if (!key.endsWith(".json")) continue;
        const size = Number(block.match(/<Size>([^<]+)<\/Size>/)?.[1] ?? "0");
        const lastModified = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? "";
        const name = key.slice(PREFIX.length, -".json".length);
        items.push({ name, key, size, lastModified });
      }
      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const name = String(body?.name ?? "");
      const key = keyFor(name);
      const r = await aws.fetch(`${base}/${key}`);
      if (r.status === 404) {
        await r.body?.cancel();
        return new Response(JSON.stringify({ data: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await r.text();
      if (!r.ok) throw new Error(`Download falhou [${r.status}]: ${text}`);
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const name = String(body?.name ?? "");
      const data = body?.data;
      if (!data || typeof data !== "object") throw new Error("Payload inválido");
      const key = keyFor(name);
      const payload = JSON.stringify({ ...data, _name: name, _savedAt: new Date().toISOString() });
      const r = await aws.fetch(`${base}/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`Upload falhou [${r.status}]: ${txt}`);
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const name = String(body?.name ?? "");
      const key = keyFor(name);
      const r = await aws.fetch(`${base}/${key}`, { method: "DELETE" });
      const txt = await r.text();
      if (!r.ok && r.status !== 404) throw new Error(`Delete falhou [${r.status}]: ${txt}`);
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("de-para-s3 error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

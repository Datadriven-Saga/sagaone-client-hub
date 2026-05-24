import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_URL = "https://connector-gateway.lovable.dev";
const GATEWAY_URL = `${API_URL}/aws_s3`;
const PREFIX = "de-para/";

function keyFor(name: string) {
  const safe = name.trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
  if (!safe) throw new Error("Nome inválido");
  return `${PREFIX}${safe}.json`;
}

async function getSignedUrl(mode: "read" | "write", objectKey: string, apiKey: string, lovableKey: string) {
  const res = await fetch(`${API_URL}/api/v1/sign_storage_url?provider=aws_s3&mode=${mode}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ object_path: objectKey }),
  });
  if (!res.ok) throw new Error(`Sign ${mode} falhou [${res.status}]: ${await res.text()}`);
  return (await res.json()) as { url: string; method: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const AWS_S3_API_KEY = Deno.env.get("AWS_S3_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!AWS_S3_API_KEY) throw new Error("AWS_S3_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list") {
      const params = new URLSearchParams({ "list-type": "2", prefix: PREFIX, "max-keys": "1000" });
      const res = await fetch(`${GATEWAY_URL}/?${params}`, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": AWS_S3_API_KEY,
        },
      });
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
      const { url } = await getSignedUrl("read", key, AWS_S3_API_KEY, LOVABLE_API_KEY);
      const r = await fetch(url);
      if (r.status === 404) {
        return new Response(JSON.stringify({ data: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!r.ok) throw new Error(`Download falhou [${r.status}]`);
      const text = await r.text();
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
      const { url, method } = await getSignedUrl("write", key, AWS_S3_API_KEY, LOVABLE_API_KEY);
      const r = await fetch(url, {
        method: method || "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, _name: name, _savedAt: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`Upload falhou [${r.status}]: ${await r.text()}`);
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
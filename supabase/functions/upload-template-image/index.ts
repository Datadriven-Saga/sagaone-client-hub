import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_TOKEN = Deno.env.get("SAGA_ONE_ADMIN_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BUCKET = "whatsapp-templates";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Normaliza telefone BR para o formato usado no DB:
 * - remove tudo que não é dígito
 * - remove DDI 55 quando vem com 12-13 dígitos
 * - remove o 9º dígito (mobile) se vier com 11 dígitos
 * Retorna string com 10 dígitos (DDD + 8) ou o que conseguir normalizar.
 */
function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3);
  return d;
}

function getAuthToken(req: Request): string {
  const h = req.headers.get("authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return req.headers.get("x-admin-token")?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1) Auth
  if (!ADMIN_TOKEN) {
    return json({ error: "SAGA_ONE_ADMIN_TOKEN não configurado" }, 500);
  }
  const token = getAuthToken(req);
  if (!token || token !== ADMIN_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2) Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return json({ error: "multipart/form-data inválido", detail: String(err) }, 400);
  }

  const idpriRaw = (form.get("idpri") ?? form.get("telefone") ?? "").toString().trim();
  const file = form.get("file");

  if (!idpriRaw) return json({ error: "Campo 'idpri' é obrigatório" }, 400);
  if (!file || !(file instanceof File)) {
    return json({ error: "Campo 'file' (binário) é obrigatório" }, 400);
  }

  // 3) Validate file
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return json(
      { error: `MIME não permitido: ${mime}. Aceitos: ${[...ALLOWED_MIME].join(", ")}` },
      400,
    );
  }
  if (file.size > MAX_SIZE) {
    return json(
      { error: `Arquivo excede 5 MB (${file.size} bytes)` },
      400,
    );
  }

  // 4) Normalize phone & validate agent
  const idpri = normalizePhone(idpriRaw);
  if (idpri.length < 10) {
    return json({ error: `Telefone inválido após normalização: '${idpri}'` }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Procura em agentes_ia e controle_agentes (qualquer match serve)
  const [{ data: ag1 }, { data: ag2 }] = await Promise.all([
    supabase.from("agentes_ia").select("id").eq("telefone", idpri).limit(1).maybeSingle(),
    supabase
      .from("controle_agentes")
      .select("id")
      .eq("telefone", idpri)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!ag1 && !ag2) {
    return json(
      { error: `Agente não encontrado para telefone '${idpri}'` },
      404,
    );
  }

  // 5) Upload
  const ext = EXT_BY_MIME[mime] ?? "bin";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `templates-api/${idpri}/${Date.now()}-${rand}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    console.error("[upload-template-image] storage error", upErr);
    return json({ error: "Falha no upload", detail: upErr.message }, 500);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return json({
    url: pub.publicUrl,
    path,
    bucket: BUCKET,
    size: file.size,
    mime_type: mime,
    idpri,
  });
});
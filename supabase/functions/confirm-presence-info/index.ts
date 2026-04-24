import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGet(token: string) {
  // Buscar contato pelo qr_token
  const { data: contato, error } = await supabase
    .from("contatos")
    .select(
      "id, nome, qr_token, confirmed_at, vendedor_nome, empresa_id, status",
    )
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar contato:", error);
    return jsonResponse({ error: "internal_error" }, 500);
  }

  if (!contato) {
    return jsonResponse({ error: "not_found" }, 404);
  }

  // Buscar evento mais recente vinculado ao contato (via eventos_prospeccao -> prospeccoes)
  const { data: vinculos } = await supabase
    .from("eventos_prospeccao")
    .select("prospeccao_id, prospeccoes(titulo, data_inicio, data_fim, imagem_divulgacao_url, empresa_id)")
    .eq("contato_id", contato.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const prospeccao = vinculos?.[0]?.prospeccoes as any;

  // Buscar empresa
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome_empresa, endereco, cidade, uf")
    .eq("id", contato.empresa_id)
    .maybeSingle();

  const evento_finalizado = prospeccao?.data_fim
    ? new Date(prospeccao.data_fim) < new Date(new Date().toDateString())
    : false;

  return jsonResponse({
    nome: contato.nome,
    convidado_por: contato.vendedor_nome ?? null,
    qr_token: contato.qr_token,
    confirmed_at: contato.confirmed_at,
    evento_finalizado,
    evento: prospeccao
      ? {
          titulo: prospeccao.titulo,
          data_inicio: prospeccao.data_inicio,
          data_fim: prospeccao.data_fim,
          imagem_divulgacao_url: prospeccao.imagem_divulgacao_url,
        }
      : null,
    empresa: empresa
      ? {
          nome: empresa.nome_empresa,
          endereco: empresa.endereco,
          cidade: empresa.cidade,
          uf: empresa.uf,
        }
      : null,
  });
}

async function handlePost(token: string) {
  const { data: contato, error: fetchErr } = await supabase
    .from("contatos")
    .select("id, status, confirmed_at")
    .eq("qr_token", token)
    .maybeSingle();

  if (fetchErr || !contato) {
    return jsonResponse({ error: "not_found" }, 404);
  }

  if (contato.confirmed_at) {
    return jsonResponse({ ok: true, confirmed_at: contato.confirmed_at, already: true });
  }

  const now = new Date().toISOString();

  // Atualiza confirmed_at; se status atual = 'Convidado', move para 'Confirmado'
  const updates: Record<string, unknown> = { confirmed_at: now };
  if (contato.status === "Convidado") {
    updates.status = "Confirmado";
  }

  const { error: updateErr } = await supabase
    .from("contatos")
    .update(updates)
    .eq("id", contato.id);

  if (updateErr) {
    console.error("Erro ao confirmar:", updateErr);
    return jsonResponse({ error: "update_failed" }, 500);
  }

  return jsonResponse({ ok: true, confirmed_at: now });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) return jsonResponse({ error: "missing_token" }, 400);
      return await handleGet(token);
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = body?.token;
      if (!token) return jsonResponse({ error: "missing_token" }, 400);
      return await handlePost(token);
    }

    return jsonResponse({ error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
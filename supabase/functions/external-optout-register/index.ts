// Edge Function: external-optout-register
// Registra (POST) um contato no opt-out externo regulatório.
// O canal é herdado do contexto (evento/prospecção) e só pode ser "ligacao" ou "whatsapp".
// Apenas o flag do canal informado vai como false; os demais permanecem true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapMarcaForApi } from "../_shared/external-optout.ts";

const API_URL =
  "https://q009ac7jeg.execute-api.us-east-1.amazonaws.com/v1/opt-in";
const API_TIMEOUT_MS = 10_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Canal = "ligacao" | "whatsapp";

interface RequestBody {
  telefone_cliente: string;
  cpf_cliente?: string | null;
  email_cliente?: string | null;
  nome_completo_cliente: string;
  marca: string;
  uf: string;
  canal: Canal;
  justificativa: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // 1. Autenticação
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Não autenticado" });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabaseUser.auth
    .getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return json(401, { error: "Não autenticado" });
  }
  const userId = claimsData.claims.sub as string;
  const userEmail = (claimsData.claims.email as string | undefined) ?? "";

  // 2. Profile do solicitante
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nome_completo, tipo_acesso, departamento")
    .eq("id", userId)
    .maybeSingle();

  const nomeSolicitante = profile?.nome_completo?.trim() || userEmail ||
    "Usuário SagaOne";
  const cargoSolicitante = profile?.departamento?.trim() ||
    profile?.tipo_acesso?.trim() || "Operador";

  // 3. Parse body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  // 4. Validações
  const errors: string[] = [];
  if (!body.telefone_cliente?.toString().trim()) {
    errors.push("telefone_cliente é obrigatório");
  }
  if (!body.nome_completo_cliente?.trim()) {
    errors.push("nome_completo_cliente é obrigatório");
  }
  if (!body.marca?.trim()) errors.push("marca é obrigatória");
  if (!body.uf?.trim()) errors.push("uf é obrigatória");
  if (body.canal !== "ligacao" && body.canal !== "whatsapp") {
    errors.push("canal inválido (use 'ligacao' ou 'whatsapp')");
  }
  const just = (body.justificativa ?? "").toString().trim();
  if (!just) errors.push("justificativa é obrigatória");
  else if (just.length < 10) {
    errors.push("justificativa deve ter no mínimo 10 caracteres");
  } else if (just.length > 200) {
    errors.push("justificativa deve ter no máximo 200 caracteres");
  }
  if (errors.length > 0) return json(400, { error: errors.join("; ") });

  // 5. Normalizações
  const telefoneNorm = body.telefone_cliente.toString().replace(/\D/g, "");
  if (telefoneNorm.length < 10 || telefoneNorm.length > 13) {
    return json(400, { error: "Telefone inválido" });
  }

  let cpfNorm: string | null = null;
  if (body.cpf_cliente) {
    const d = body.cpf_cliente.toString().replace(/\D/g, "");
    if (d.length === 11) cpfNorm = d;
  }

  let emailNorm: string | null = null;
  if (body.email_cliente) {
    const e = body.email_cliente.toString().trim().toLowerCase();
    if (e.includes("@")) emailNorm = e;
  }

  // 6. Flags de canal
  const payload = {
    telefone_cliente: telefoneNorm,
    cpf_cliente: cpfNorm,
    email_cliente: emailNorm,
    nome_completo_cliente: body.nome_completo_cliente.trim(),
    marca: mapMarcaForApi(body.marca),
    uf: body.uf.trim().toUpperCase(),
    call_optin: body.canal !== "ligacao",
    email_optin: true,
    sms_optin: true,
    whatsapp_optin: body.canal !== "whatsapp",
    pesquisa_optin: true,
    nome_solicitante: nomeSolicitante,
    cargo_solicitante: cargoSolicitante,
  };

  // 7. Secret
  const apiKey = Deno.env.get("OPT_OUT_X_API_KEY");
  if (!apiKey) {
    console.error(
      "[external-optout-register] OPT_OUT_X_API_KEY não configurado",
    );
    return json(500, { error: "Configuração de opt-out externo ausente" });
  }

  // 8. POST na API externa
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") {
      console.error("[external-optout-register] Timeout", {
        userId,
        marca: payload.marca,
        uf: payload.uf,
        canal: body.canal,
      });
      return json(504, { error: "Timeout ao registrar opt-out externo" });
    }
    console.error("[external-optout-register] Erro de rede", {
      error: err?.message ?? String(err),
      userId,
    });
    return json(502, {
      error: "Erro de comunicação com API de opt-out externo",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error("[external-optout-register] API retornou erro", {
      status: response.status,
      userId,
      marca: payload.marca,
      uf: payload.uf,
      canal: body.canal,
      responseSnippet: bodyText.slice(0, 200),
    });
    return json(502, {
      error: `Erro ao registrar opt-out externo (HTTP ${response.status})`,
    });
  }

  console.log("[external-optout-register] Opt-out registrado", {
    userId,
    nomeSolicitante,
    cargoSolicitante,
    marca: payload.marca,
    uf: payload.uf,
    canal: body.canal,
    justificativa: just,
  });

  // 9. Timeline (best-effort) — busca contato pela empresa + telefone (raw e variantes)
  try {
    // Tenta tanto o telefone original quanto a variante com dígito 9
    const variants = new Set<string>([telefoneNorm]);
    if (telefoneNorm.length === 10) {
      variants.add(telefoneNorm.slice(0, 2) + "9" + telefoneNorm.slice(2));
    }
    if (telefoneNorm.length === 11 && telefoneNorm[2] === "9") {
      variants.add(telefoneNorm.slice(0, 2) + telefoneNorm.slice(3));
    }

    const { data: contato } = await supabaseAdmin
      .from("contatos")
      .select("id")
      .in("telefone", Array.from(variants))
      .limit(1)
      .maybeSingle();

    if (contato?.id) {
      await supabaseAdmin.from("contato_timeline").insert({
        contato_id: contato.id,
        tipo: "optout_externo",
        descricao:
          `Opt-out externo registrado por ${nomeSolicitante}. Canal: ${body.canal}. Justificativa: ${just}`,
        usuario_id: userId,
        usuario_nome: nomeSolicitante,
        metadata: {
          canal: body.canal,
          marca: payload.marca,
          uf: payload.uf,
          cargo_solicitante: cargoSolicitante,
        },
      });
    }
  } catch (timelineErr: any) {
    console.warn("[external-optout-register] Falha ao registrar timeline", {
      error: timelineErr?.message ?? String(timelineErr),
    });
  }

  return json(200, {
    success: true,
    message: "Opt-out registrado com sucesso",
  });
});

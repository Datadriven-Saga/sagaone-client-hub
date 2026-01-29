import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_TIPOS = new Set([
  "curso",
  "simulacao_voz",
  "simulacao_texto",
  "video",
  "documento",
]);
const ALLOWED_NIVEIS = new Set(["iniciante", "intermediario", "avancado"]);

function safeJsonParse(input: string) {
  const trimmed = input.trim();
  // handle ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const maybeJson = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(maybeJson);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("academy-generate-training: OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("academy-generate-training: auth error", authError);
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission gate (to avoid uncontrolled OpenAI usage)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tipo_acesso")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("academy-generate-training: profile error", profileError);
      return new Response(JSON.stringify({ error: "Erro ao validar permissões" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = [
      "Administrador",
      "TI",
      "Diretor",
      "Gerente de Leads",
      "Gerente de Loja",
    ];
    if (!profile || !allowed.includes(profile.tipo_acesso)) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para gerar treinamento com IA" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "").trim();
    const suggestedNivel = String(body?.suggestedNivel ?? "").trim();
    const suggestedTipo = String(body?.suggestedTipo ?? "").trim();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("academy-generate-training: generating", {
      user_id: user.id,
      suggestedNivel,
      suggestedTipo,
      promptPreview: prompt.slice(0, 80),
    });

    const system =
      "Você é um gerador de treinamentos do Saga Academy (concessionárias). " +
      "Retorne SOMENTE JSON válido (sem markdown) com os campos: " +
      "titulo (string), descricao (string), tipo (curso|simulacao_voz|simulacao_texto|video|documento), " +
      "nivel (iniciante|intermediario|avancado), duracao_estimada_minutos (number), publico_alvo (string[]).";

    const userMsg =
      `Crie um treinamento a partir do pedido abaixo.\n\n` +
      `Pedido: ${prompt}\n\n` +
      `Preferências (se fizer sentido):\n` +
      `- tipo sugerido: ${suggestedTipo || "(nenhum)"}\n` +
      `- nível sugerido: ${suggestedNivel || "(nenhum)"}`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload),
    });

    const raw = await openaiRes.text();
    if (!openaiRes.ok) {
      console.error("academy-generate-training: openai error", openaiRes.status, raw);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar com IA", status: openaiRes.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const parsed = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("academy-generate-training: empty content", parsed);
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      result = typeof content === "string" ? safeJsonParse(content) : content;
    } catch (e) {
      console.error("academy-generate-training: json parse error", e, content);
      return new Response(
        JSON.stringify({ error: "Falha ao interpretar resposta da IA" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize and validate
    const titulo = String(result?.titulo ?? "").trim();
    const descricao = String(result?.descricao ?? "").trim();
    let tipo = String(result?.tipo ?? suggestedTipo ?? "curso").trim();
    let nivel = String(result?.nivel ?? suggestedNivel ?? "intermediario").trim();
    const duracao_estimada_minutos = Number(result?.duracao_estimada_minutos ?? 30);
    const publico_alvo = Array.isArray(result?.publico_alvo)
      ? result.publico_alvo.map((x: any) => String(x))
      : [];

    if (!ALLOWED_TIPOS.has(tipo)) tipo = "curso";
    if (!ALLOWED_NIVEIS.has(nivel)) nivel = "intermediario";

    const responseBody = {
      titulo: titulo || `Treinamento: ${prompt.slice(0, 60)}`,
      descricao: descricao || prompt,
      tipo,
      nivel,
      duracao_estimada_minutos: Number.isFinite(duracao_estimada_minutos)
        ? Math.max(5, Math.min(240, Math.round(duracao_estimada_minutos)))
        : 30,
      publico_alvo,
    };

    console.log("academy-generate-training: done", {
      user_id: user.id,
      tipo: responseBody.tipo,
      nivel: responseBody.nivel,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("academy-generate-training: unexpected error", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

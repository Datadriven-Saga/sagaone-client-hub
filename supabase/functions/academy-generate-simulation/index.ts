import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Valid DB values
const VALID_TIPOS = ["voz", "texto"];
const VALID_DIFICULDADES = ["Fácil", "Médio", "Difícil"];

function safeJsonParse(input: string) {
  const trimmed = input.trim();
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
      console.error("academy-generate-simulation: OPENAI_API_KEY not configured");
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
      console.error("academy-generate-simulation: auth error", authError);
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tipo_acesso")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("academy-generate-simulation: profile error", profileError);
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
        JSON.stringify({ error: "Sem permissão para gerar simulação com IA" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "").trim();
    const tipo = String(body?.tipo ?? "voz").trim();
    const departamento = String(body?.departamento ?? "Vendas Novos").trim();
    const nivel = String(body?.nivel ?? "intermediario").trim();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("academy-generate-simulation: generating", {
      user_id: user.id,
      tipo,
      departamento,
      nivel,
      promptPreview: prompt.slice(0, 80),
    });

    // Map nivel to dificuldade label
    const dificuldadeMap: Record<string, string> = {
      "iniciante": "Fácil",
      "intermediario": "Médio", 
      "avancado": "Difícil",
    };
    const dificuldade = dificuldadeMap[nivel] || "Médio";

    const system = `Você é um especialista em treinamento de vendas automotivas do Saga Academy.
Sua tarefa é criar cenários de roleplay realistas para treinar colaboradores de CONCESSIONÁRIAS DE VEÍCULOS.

CONTEXTO OBRIGATÓRIO: Esta plataforma é exclusivamente para concessionárias de automóveis. 
Todos os cenários DEVEM estar relacionados ao setor automotivo:
- Vendas Novos: Venda de veículos 0km
- Vendas Usados: Venda de seminovos e usados
- Pós-Venda: Revisões, garantias, recalls, pacotes de manutenção
- Oficina/Serviços: Agendamento de serviços, orçamentos de reparos, peças e acessórios
- F&I: Financiamento, seguros, proteção veicular, consórcios
- Recepção: Atendimento inicial, direcionamento de clientes, agendamentos

Retorne SOMENTE JSON válido (sem markdown) com a seguinte estrutura:
{
  "titulo": "Título curto e descritivo da simulação",
  "descricao": "Descrição do cenário em 2-3 frases",
  "cenario": {
    "contexto": "Descrição detalhada da situação - onde está o cliente, o que ele procura, qual seu estado emocional",
    "objetivo": "O que o vendedor deve alcançar nesta simulação"
  },
  "persona": {
    "nome": "Nome realista brasileiro",
    "cargo": "Profissão/cargo do cliente",
    "empresa": "Empresa ou contexto profissional",
    "perfil_psicologico": "Como o cliente se comporta, suas preocupações principais",
    "objecoes_principais": ["Lista de objeções que o cliente pode levantar"],
    "gatilhos_compra": ["O que pode convencer este cliente a fechar"]
  },
  "prompt_sistema": "Instruções detalhadas para a IA sobre como interpretar este personagem durante o roleplay. Inclua: tom de voz, nível de resistência, pontos de dor, quando ceder, quando insistir, personalidade, contexto de vida que influencia a decisão."
}`;

    const userMsg = `Crie uma simulação de roleplay para o departamento "${departamento}" com dificuldade "${dificuldade}".

Descrição do cenário desejado: ${prompt}

Tipo de simulação: ${tipo === "voz" ? "Simulação por voz (conversa telefônica ou presencial)" : "Simulação por texto (chat/WhatsApp)"}

IMPORTANTE - CONTEXTO DE CONCESSIONÁRIA:
- TODOS os cenários devem ser sobre veículos, peças, serviços automotivos ou processos de concessionária
- A persona deve ser um cliente interessado em algo relacionado a automóveis
- As objeções devem ser realistas para o mercado automotivo (preço, financiamento, troca, garantia, etc.)
- O cenário deve refletir situações reais do dia-a-dia de uma concessionária de veículos
- Mesmo que a descrição seja genérica, adapte para o contexto automotivo`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      temperature: 0.7,
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
      console.error("academy-generate-simulation: openai error", openaiRes.status, raw);
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
      console.error("academy-generate-simulation: empty content", parsed);
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      result = typeof content === "string" ? safeJsonParse(content) : content;
    } catch (e) {
      console.error("academy-generate-simulation: json parse error", e, content);
      return new Response(
        JSON.stringify({ error: "Falha ao interpretar resposta da IA" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize and validate
    const titulo = String(result?.titulo ?? "").trim() || `Simulação: ${prompt.slice(0, 50)}`;
    const descricao = String(result?.descricao ?? "").trim() || prompt;
    
    const cenario = {
      departamento,
      contexto: String(result?.cenario?.contexto ?? descricao).trim(),
      objetivo: String(result?.cenario?.objetivo ?? "").trim(),
    };

    const persona = {
      id: crypto.randomUUID(),
      nome: String(result?.persona?.nome ?? "Cliente").trim(),
      cargo: String(result?.persona?.cargo ?? "Profissional").trim(),
      empresa: String(result?.persona?.empresa ?? "Empresa").trim(),
      dificuldade: VALID_DIFICULDADES.includes(dificuldade) ? dificuldade : "Médio",
      descricao: String(result?.persona?.perfil_psicologico ?? "").trim(),
      objetivo: cenario.objetivo,
      objecoes_principais: Array.isArray(result?.persona?.objecoes_principais) 
        ? result.persona.objecoes_principais 
        : [],
      gatilhos_compra: Array.isArray(result?.persona?.gatilhos_compra)
        ? result.persona.gatilhos_compra
        : [],
    };

    const promptSistema = String(result?.prompt_sistema ?? "").trim() || 
      `Você é ${persona.nome}, ${persona.cargo} da ${persona.empresa}. ${persona.descricao}`;

    // Determine voice based on persona name (simple heuristic)
    const nomesFemininos = ["maria", "ana", "julia", "carla", "fernanda", "patricia", "luciana", "claudia", "sandra", "rosa"];
    const primeiroNome = persona.nome.toLowerCase().split(" ")[0];
    const isFeminino = nomesFemininos.some(n => primeiroNome.includes(n));
    const vozSugerida = isFeminino ? "shimmer" : "onyx";

    const responseBody = {
      titulo,
      descricao,
      tipo: VALID_TIPOS.includes(tipo) ? tipo : "voz",
      cenario,
      persona,
      prompt_sistema: promptSistema,
      config_voz: {
        voz_openai: vozSugerida,
        genero: isFeminino ? "F" : "M",
      },
    };

    console.log("academy-generate-simulation: done", {
      user_id: user.id,
      tipo: responseBody.tipo,
      persona_nome: responseBody.persona.nome,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("academy-generate-simulation: unexpected error", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_TOKEN = Deno.env.get("SAGA_ONE_ADMIN_TOKEN") ?? "";
const PRI_IA_EMAIL = "pri.ia@sagadatadriven.com.br";
const PRI_IA_USER_ID = Deno.env.get("PRI_IA_USER_ID") ?? "";

const ORIGENS_VALIDAS = new Set(["mobi", "whatsapp_pri"]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Normaliza telefone seguindo regra do projeto:
 *  - mantém apenas dígitos
 *  - remove DDI 55 quando aplicável
 *  - remove 9º dígito de celular (DDD + 9 + 8 dígitos -> DDD + 8 dígitos)
 */
function normalizarTelefone(input: string): string {
  let t = String(input || "").replace(/\D/g, "");
  if (t.length === 13 && t.startsWith("55")) t = t.slice(2);
  if (t.length === 12 && t.startsWith("55")) t = t.slice(2);
  if (t.length === 11 && t[2] === "9") {
    t = t.slice(0, 2) + t.slice(3);
  }
  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido. Use POST." });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return json(401, {
        error: "Token inválido ou ausente",
        uso: "Header Authorization: Bearer <SAGA_ONE_ADMIN_TOKEN>",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { error: "Body JSON inválido" });
    }

    const {
      nome,
      telefone,
      prospeccao_id,
      origem,
      id_evento_pri,
      observacoes,
    } = body as Record<string, unknown>;

    if (typeof nome !== "string" || !nome.trim()) {
      return json(400, { error: 'Campo "nome" é obrigatório' });
    }
    if (typeof telefone !== "string" || !telefone.trim()) {
      return json(400, { error: 'Campo "telefone" é obrigatório' });
    }
    if (typeof prospeccao_id !== "string" || !prospeccao_id.trim()) {
      return json(400, { error: 'Campo "prospeccao_id" é obrigatório (UUID do evento no SagaOne)' });
    }
    if (typeof origem !== "string" || !ORIGENS_VALIDAS.has(origem)) {
      return json(400, {
        error: 'Campo "origem" inválido',
        permitidos: Array.from(ORIGENS_VALIDAS),
      });
    }

    const telefoneNormalizado = normalizarTelefone(telefone);
    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      return json(400, { error: "Telefone inválido após normalização", telefone_normalizado: telefoneNormalizado });
    }

    // 1. Resolver evento
    const { data: evento, error: eventoErr } = await supabase
      .from("prospeccoes")
      .select("id, titulo, empresa_id, ativo, encerrado_at, data_fim")
      .eq("id", prospeccao_id)
      .maybeSingle();

    if (eventoErr) {
      console.error("Erro ao buscar evento:", eventoErr);
      return json(500, { error: "Erro ao buscar evento", detalhes: eventoErr.message });
    }
    if (!evento) {
      return json(404, { error: "Evento não encontrado", prospeccao_id });
    }
    if (evento.ativo === false || evento.encerrado_at) {
      return json(400, { error: "Evento encerrado/inativo", prospeccao_id });
    }

    const empresa_id = evento.empresa_id as string;

    // 2. Descobrir se contato já existia e se já tinha vínculo com este evento
    //    (precisa ser feito ANTES do bulk_upsert_contatos para que os flags sejam reais)
    const { data: contatoPrev } = await supabase
      .from("contatos")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("telefone", telefoneNormalizado)
      .maybeSingle();

    let vinculo_ja_existia = false;
    if (contatoPrev?.id) {
      const { data: vincPrev } = await supabase
        .from("eventos_prospeccao")
        .select("id")
        .eq("contato_id", contatoPrev.id)
        .eq("prospeccao_id", prospeccao_id)
        .limit(1)
        .maybeSingle();
      vinculo_ja_existia = !!vincPrev;
    }

    // 3. Upsert via RPC oficial (deduplicação + vínculo automático em eventos_prospeccao)
    const observacoesFinal = [
      typeof observacoes === "string" ? observacoes.trim() : null,
      id_evento_pri ? `pri_evento_id:${id_evento_pri}` : null,
    ].filter(Boolean).join(" | ") || null;

    const contatoPayload = [{
      nome: nome.trim(),
      telefone: telefoneNormalizado,
      observacoes: observacoesFinal,
    }];

    const { data: upsertRes, error: upsertErr } = await supabase.rpc("bulk_upsert_contatos", {
      p_contatos: contatoPayload,
      p_empresa_id: empresa_id,
      p_prospeccao_id: prospeccao_id,
      p_canal: "whatsapp",
      p_force_status_novo: false,
    });

    if (upsertErr) {
      console.error("Erro em bulk_upsert_contatos:", upsertErr);
      return json(500, { error: "Erro ao upsert do contato", detalhes: upsertErr.message });
    }

    console.log("bulk_upsert_contatos resultado:", JSON.stringify(upsertRes));

    // 4. Buscar contato resultante por telefone+empresa
    const { data: contato, error: contatoErr } = await supabase
      .from("contatos")
      .select("id, lead_id, nome, telefone, status, responsavel_email, origem_pri, created_at")
      .eq("empresa_id", empresa_id)
      .eq("telefone", telefoneNormalizado)
      .maybeSingle();

    if (contatoErr || !contato) {
      console.error("Não foi possível recuperar contato após upsert:", contatoErr);
      return json(500, { error: "Contato não localizado após upsert" });
    }

    const duplicado = contato.created_at
      ? (Date.now() - new Date(contato.created_at).getTime()) > 5_000
      : false;

    // 5. Verificar/garantir vínculo (bulk_upsert_contatos já faz IF NOT EXISTS)
    const { data: vinculoExistente } = await supabase
      .from("eventos_prospeccao")
      .select("id")
      .eq("contato_id", contato.id)
      .eq("prospeccao_id", prospeccao_id)
      .limit(1)
      .maybeSingle();
    const vinculo_criado = !!vinculoExistente; // sempre true após o upsert

    // 6. Setar origem_pri (preservando valor antigo) e atribuir Pri IA se status ainda for "Novo"
    const updates: Record<string, unknown> = {};
    if (!contato.origem_pri) updates.origem_pri = origem;

    const podeAtribuir = !contato.responsavel_email && (contato.status === "Novo" || !contato.status);
    if (podeAtribuir) {
      updates.status = "Atribuído";
      updates.responsavel_email = PRI_IA_EMAIL;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase
        .from("contatos")
        .update(updates)
        .eq("id", contato.id);
      if (updErr) {
        console.error("Erro ao atualizar origem_pri/atribuição:", updErr);
      }
    }

    // 7. Auditoria em logs_prospeccoes (interno)
    try {
      await supabase.from("logs_prospeccoes").insert({
        prospeccao_id,
        empresa_id,
        contato_id: contato.id,
        acao: duplicado ? "lead_vinculado_pri" : "lead_criado_pri",
        origem: "pri",
        detalhes: {
          origem_pri: origem,
          id_evento_pri: id_evento_pri ?? null,
          duplicado,
          vinculo_ja_existia,
          telefone: telefoneNormalizado,
        },
      });
    } catch (logErr) {
      console.warn("Falha ao logar em logs_prospeccoes (ignorando):", logErr);
    }

    // 8. Rastro visível em logs_movimentacao_contatos (timeline unificado do lead).
    //    A trigger PG dispara o dispatcher, mas ele faz skip por usuario_id=Pri IA
    //    (guarda em _shared/movimentacao-lead-webhook.ts). Sem PRI_IA_USER_ID, pulamos
    //    a escrita para evitar risco de vazar chamada ao Mobi.
    if (PRI_IA_USER_ID) {
      try {
        const statusAtual = podeAtribuir ? "Atribuído" : (contato.status ?? "Novo");
        const obsTimeline = [
          `Pri IA (${origem}) — vínculo ${vinculo_ja_existia ? "reforçado" : "criado"}`,
          id_evento_pri ? `pri_evento_id:${id_evento_pri}` : null,
        ].filter(Boolean).join(" | ");

        await supabase.from("logs_movimentacao_contatos").insert({
          contato_id: contato.id,
          prospeccao_id,
          status_anterior: statusAtual,
          status_novo: statusAtual,
          usuario_id: PRI_IA_USER_ID,
          observacoes: obsTimeline,
        });
      } catch (movErr) {
        console.warn("Falha ao logar em logs_movimentacao_contatos (ignorando):", movErr);
      }
    } else {
      console.warn("PRI_IA_USER_ID ausente — pulando log em logs_movimentacao_contatos");
    }

    return json(duplicado ? 200 : 201, {
      success: true,
      duplicado,
      vinculo_criado,
      vinculo_ja_existia,
      lead_id: contato.lead_id,
      contato_id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      status: podeAtribuir ? "Atribuído" : contato.status,
      responsavel_email: podeAtribuir ? PRI_IA_EMAIL : contato.responsavel_email,
      origem_pri: contato.origem_pri || origem,
      origem_pri_existente: contato.origem_pri && contato.origem_pri !== origem ? contato.origem_pri : null,
      prospeccao_id,
      empresa_id,
      evento: evento.titulo,
    });
  } catch (err) {
    console.error("Erro inesperado em create-lead-pri:", err);
    return json(500, { error: "Erro interno do servidor" });
  }
});
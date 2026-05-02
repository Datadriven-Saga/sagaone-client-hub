// Helper compartilhado: dispara o webhook externo `movimentacao_lead_kanban`
// e captura o `codigo_proposta` retornado pelo MobiGestor.
//
// Usado por:
//  - trigger-webhook (chamadas autenticadas a partir do app)
//  - confirm-presence (endpoint público de confirmação via link)
//
// Mantém paridade total com a lógica que existia inline em trigger-webhook.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MovimentacaoLeadDados {
  contato_id: string;
  empresa_id: string;
  prospeccao_id: string;
  status_anterior?: string | null;
  status_novo: string;
  lead_id?: number | string | null;
  usuario_id?: string | null;
  origem?: string | null;
}

export interface MovimentacaoLeadResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  webhook_status?: number;
  error?: string;
  detail?: string;
}

function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return { valid: false, error: "Only HTTPS URLs are allowed" };
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("127.") ||
      hostname === "0.0.0.0" ||
      hostname === "::1"
    ) return { valid: false, error: "Localhost URLs not allowed" };

    const ipv4Parts = hostname.split(".");
    if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(parseInt(p)))) {
      const first = parseInt(ipv4Parts[0]);
      const second = parseInt(ipv4Parts[1]);
      if (
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254)
      ) return { valid: false, error: "Private IPs not allowed" };
    }

    const blockedHosts = ["169.254.169.254", "metadata.google.internal", "metadata", "instance-data"];
    if (blockedHosts.some((b) => hostname.includes(b))) {
      return { valid: false, error: "Metadata endpoints not allowed" };
    }
    const internalServices = ["supabase-kong", "supabase-db", "postgres", "postgresql", "internal"];
    if (internalServices.some((s) => hostname.includes(s))) {
      return { valid: false, error: "Internal services not allowed" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

export async function dispararMovimentacaoLeadKanban(
  supabase: SupabaseClient,
  dados: MovimentacaoLeadDados,
): Promise<MovimentacaoLeadResult> {
  // 0. Validação
  const required: (keyof MovimentacaoLeadDados)[] = [
    "contato_id",
    "empresa_id",
    "prospeccao_id",
    "status_novo",
  ];
  const missing = required.filter((k) => !dados?.[k]);
  if (missing.length > 0) {
    return { success: false, error: "campos_ausentes", detail: missing.join(",") };
  }

  // 1. Skip Pri IA
  const PRI_IA_USER_ID = Deno.env.get("PRI_IA_USER_ID");
  if (dados.usuario_id && PRI_IA_USER_ID && dados.usuario_id === PRI_IA_USER_ID) {
    console.log("[movimentacao-lead] ⏭️ skip pri_ia");
    return { success: true, skipped: true, reason: "pri_ia" };
  }

  // 2. Feature flag por empresa
  const { data: flagEnabled } = await supabase.rpc("is_feature_enabled_for_empresa", {
    p_flag_key: "webhook_movimentacao_lead",
    p_empresa_id: dados.empresa_id,
  });
  if (!flagEnabled) {
    console.log("[movimentacao-lead] ⏭️ flag_disabled empresa=", dados.empresa_id);
    return { success: true, skipped: true, reason: "flag_disabled" };
  }

  // 3. Canal elegível
  const { data: prospeccaoData } = await supabase
    .from("prospeccoes")
    .select("canal, titulo")
    .eq("id", dados.prospeccao_id)
    .single();

  if (prospeccaoData?.canal !== "Mensal" && prospeccaoData?.canal !== "Grande Evento") {
    console.log("[movimentacao-lead] ⏭️ canal_nao_elegivel:", prospeccaoData?.canal);
    return { success: true, skipped: true, reason: "canal_nao_elegivel" };
  }

  // 3.1 Status final elegível
  const STATUS_ELEGIVEIS = ["Confirmado", "Check-in", "Descartado"];
  if (!STATUS_ELEGIVEIS.includes(dados.status_novo)) {
    console.log("[movimentacao-lead] ⏭️ status_nao_elegivel:", dados.status_novo);
    return { success: true, skipped: true, reason: "status_nao_elegivel" };
  }

  // 4. Contato (com codigo_proposta)
  const { data: contatoData } = await supabase
    .from("contatos")
    .select("nome, telefone, codigo_proposta")
    .eq("id", dados.contato_id)
    .single();

  if (!contatoData) {
    console.error("[movimentacao-lead] ❌ contato_not_found:", dados.contato_id);
    return { success: false, error: "contato_not_found" };
  }

  // 5. Empresa (dealer_id)
  const { data: empresaData } = await supabase
    .from("empresas")
    .select("crm_id")
    .eq("id", dados.empresa_id)
    .single();

  // 6. URL do webhook
  const webhookUrl = Deno.env.get("WEBHOOK_MOVIMENTACAO_LEAD_URL");
  if (!webhookUrl) {
    console.error("[movimentacao-lead] ❌ WEBHOOK_MOVIMENTACAO_LEAD_URL ausente");
    return { success: false, error: "webhook_url_missing" };
  }
  const urlCheck = isValidWebhookUrl(webhookUrl);
  if (!urlCheck.valid) {
    console.error("[movimentacao-lead] ❌ url_blocked:", urlCheck.error);
    return { success: false, error: "webhook_url_blocked", detail: urlCheck.error };
  }

  // 7. Payload + dispatch
  const payload: Record<string, unknown> = {
    nome: contatoData.nome,
    telefone: contatoData.telefone,
    dealer_id: empresaData?.crm_id,
    nome_evento: prospeccaoData?.titulo,
    status_anterior: dados.status_anterior ?? null,
    status_novo: dados.status_novo,
    contato_id: dados.contato_id,
    lead_id: dados.lead_id ?? null,
    empresa_id: dados.empresa_id,
    prospeccao_id: dados.prospeccao_id,
    codigo_proposta: contatoData.codigo_proposta ?? null,
  };

  console.log("[movimentacao-lead] 📤 dispatching", JSON.stringify(payload));

  const SAGA_ONE = Deno.env.get("SAGA_ONE") || "";
  const webhookResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SAGA_ONE ? { "x-saga-one": SAGA_ONE } : {}),
    },
    body: JSON.stringify(payload),
  });

  let responseText = "";
  try { responseText = await webhookResponse.text(); } catch { /* noop */ }
  console.log(`[movimentacao-lead] ✅ status=${webhookResponse.status}`, responseText.substring(0, 500));

  // 8. Captura codigo_proposta
  let captured: string | null = null;
  if (webhookResponse.ok && responseText) {
    try {
      const parsed = JSON.parse(responseText);
      const candidate =
        parsed?.codigo_proposta ??
        parsed?.proposalId ??
        parsed?.proposal_id ??
        parsed?.data?.codigo_proposta ??
        parsed?.data?.proposalId ??
        parsed?.data?.proposal_id ??
        null;
      if (candidate !== null && candidate !== undefined && String(candidate).trim() !== "") {
        captured = String(candidate).trim();
      }
    } catch {
      console.log("[movimentacao-lead] ℹ️ resposta não-JSON, ignorando captura");
    }
  }

  if (captured && captured !== contatoData.codigo_proposta) {
    const { error: updErr } = await supabase
      .from("contatos")
      .update({ codigo_proposta: captured })
      .eq("id", dados.contato_id);
    if (updErr) {
      console.error("[movimentacao-lead] ❌ erro salvar codigo_proposta:", updErr.message);
    } else {
      console.log(`[movimentacao-lead] 💾 codigo_proposta salvo: ${captured} contato=${dados.contato_id}`);
    }
  }

  return { success: true, webhook_status: webhookResponse.status };
}
/**
 * PR 0 — Wrapper único para mutação de `contatos.status`.
 *
 * Roteia toda alteração de status pela edge function `prospeccao-status`,
 * que faz UPDATE + log + webhook na ordem correta (ver edge para detalhes).
 *
 * **Direct `supabase.from('contatos').update({ status })` é proibido** —
 * use sempre `setContatoStatus`. Call sites legados serão migrados
 * incrementalmente nos PRs 1-4.
 *
 * Comportamento:
 * - `ok=false` apenas quando o UPDATE não aconteceu (4xx/5xx, rede).
 * - Falha de webhook ⇒ `ok=true`, `webhookStatus='failed'|'timeout'`.
 *   Caller pode exibir aviso, mas NÃO faz rollback (status já mudou no DB).
 */
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ContatoStatus = Database['public']['Enums']['status_lead'];
export type WebhookKind = 'criacao_lead' | 'atualizacao_status' | null;
export type WebhookStatus = 'ok' | 'skipped' | 'failed' | 'timeout' | 'not_invoked';

export type SetContatoStatusInput = {
  contatoId: string;
  novoStatus: ContatoStatus;
  prospeccaoId?: string | null;
  observacoes?: string;
  skipWebhooks?: boolean;
  webhookKind?: WebhookKind;
};

export type SetContatoStatusResult = {
  ok: boolean;
  statusAnterior?: ContatoStatus | null;
  statusNovo?: ContatoStatus;
  updatedAt?: string;
  webhookStatus?: WebhookStatus;
  webhookError?: string | null;
  codigoProposta?: string | null;
  error?: string;
  httpStatus?: number;
};

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export async function setContatoStatus(input: SetContatoStatusInput): Promise<SetContatoStatusResult> {
  const { contatoId, novoStatus, prospeccaoId, observacoes, skipWebhooks, webhookKind } = input;

  if (!contatoId || !novoStatus) {
    return { ok: false, error: 'contatoId e novoStatus são obrigatórios' };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Supabase env não configurado' };
  }

  // JWT do usuário atual (nunca service-role daqui)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: 'Sessão não autenticada' };
  }

  const url = `${SUPABASE_URL}/functions/v1/prospeccao-status?lead_id=${encodeURIComponent(contatoId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        novo_status: novoStatus,
        prospeccao_id: prospeccaoId ?? null,
        observacoes: observacoes ?? null,
        skip_webhooks: skipWebhooks === true,
        webhook_kind: webhookKind ?? null,
      }),
    });
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Erro de rede' };
  }

  let payload: any = null;
  try { payload = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      error: payload?.error ?? `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    statusAnterior: payload?.status_anterior ?? null,
    statusNovo: payload?.status_novo,
    updatedAt: payload?.updated_at,
    webhookStatus: payload?.webhook_status,
    webhookError: payload?.webhook_error ?? null,
    codigoProposta: payload?.codigo_proposta ?? null,
  };
}
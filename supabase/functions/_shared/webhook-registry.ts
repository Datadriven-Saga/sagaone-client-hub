// Shared helper: resolve webhook URLs from public.webhook_registry
// Used by every edge function that needs to call an external webhook so we can
// eliminate hard-coded URLs and expose them for editing in the admin UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

export interface WebhookConfig {
  slug?: string;
  url: string;
  metodo: string;
  ativo: boolean;
  credencial_secret_name: string | null;
  credencial_header: string | null;
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve a webhook by its slug (preferred, defined in the seed).
 * Returns null if unknown. Throws if slug is registered but inactive/URL missing.
 */
export async function resolveWebhookBySlug(slug: string): Promise<WebhookConfig | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("webhook_registry")
    .select("slug,url,metodo,ativo,credencial_secret_name,credencial_header")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[webhook-registry] lookup error for ${slug}:`, error.message);
    return null;
  }
  return data
    ? {
        slug: data.slug,
        url: data.url,
        metodo: data.metodo,
        ativo: data.ativo,
        credencial_secret_name: data.credencial_secret_name,
        credencial_header: data.credencial_header,
      }
    : null;
}

/**
 * Legacy helper: resolve by matching URL path suffix (e.g. "verifica-eventos"
 * matches "https://.../webhook/verifica-eventos"). Used by external-webhook-proxy
 * so frontend keeps sending short endpoint keys without changes.
 */
export async function resolveWebhookByPathSuffix(suffix: string): Promise<WebhookConfig | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("webhook_registry")
    .select("slug,url,metodo,ativo,credencial_secret_name,credencial_header")
    .ilike("url", `%/webhook/${suffix}`)
    .limit(1);
  if (error) {
    console.error(`[webhook-registry] lookup error for ${suffix}:`, error.message);
    return null;
  }
  const row = data?.[0];
  return row
    ? {
        slug: row.slug,
        url: row.url,
        metodo: row.metodo,
        ativo: row.ativo,
        credencial_secret_name: row.credencial_secret_name,
        credencial_header: row.credencial_header,
      }
    : null;
}

/**
 * Build auth headers by reading the secret referenced in the registry entry.
 */
export function buildAuthHeaders(cfg: WebhookConfig | null): Record<string, string> {
  if (!cfg || !cfg.credencial_secret_name || !cfg.credencial_header) return {};
  const value = Deno.env.get(cfg.credencial_secret_name) ?? "";
  if (!value) return {};
  if (cfg.credencial_header.toLowerCase() === "authorization") {
    return { Authorization: value.startsWith("Bearer ") ? value : `Bearer ${value}` };
  }
  return { [cfg.credencial_header]: value };
}

export async function markWebhookUsed(slug: string): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.rpc("mark_webhook_used", { _slug: slug });
  } catch (err) {
    console.warn(`[webhook-registry] mark_webhook_used failed for ${slug}:`, err);
  }
}
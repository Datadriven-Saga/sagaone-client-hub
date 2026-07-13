// Shared helper: resolve webhook URLs from public.webhook_registry
// Used by every edge function that needs to call an external webhook so we can
// eliminate hard-coded URLs and expose them for editing in the admin UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

export interface WebhookConfig {
  url: string;
  metodo: string;
  ativo: boolean;
  credencial_secret_name: string | null;
  credencial_header: string | null;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: WebhookConfig | null; expiresAt: number }>();

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
  const cached = cache.get(`slug:${slug}`);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("get_webhook_url", { _slug: slug });
  if (error) {
    console.error(`[webhook-registry] rpc error for ${slug}:`, error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const value: WebhookConfig | null = row
    ? {
        url: row.url,
        metodo: row.metodo,
        ativo: row.ativo,
        credencial_secret_name: row.credencial_secret_name,
        credencial_header: row.credencial_header,
      }
    : null;
  cache.set(`slug:${slug}`, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Legacy helper: resolve by matching URL path suffix (e.g. "verifica-eventos"
 * matches "https://.../webhook/verifica-eventos"). Used by external-webhook-proxy
 * so frontend keeps sending short endpoint keys without changes.
 */
export async function resolveWebhookByPathSuffix(suffix: string): Promise<WebhookConfig | null> {
  const key = `suffix:${suffix}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("webhook_registry")
    .select("url,metodo,ativo,credencial_secret_name,credencial_header")
    .ilike("url", `%/webhook/${suffix}`)
    .limit(1);
  if (error) {
    console.error(`[webhook-registry] lookup error for ${suffix}:`, error.message);
    return null;
  }
  const row = data?.[0];
  const value: WebhookConfig | null = row
    ? {
        url: row.url,
        metodo: row.metodo,
        ativo: row.ativo,
        credencial_secret_name: row.credencial_secret_name,
        credencial_header: row.credencial_header,
      }
    : null;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
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
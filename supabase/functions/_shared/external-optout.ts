// External opt-out validation helper.
// Consulted by process-import BEFORE bulk_upsert_contatos to enforce
// a fail-closed policy: any contact present in the external list is blocked.
//
// Do NOT import this file from client-side code. The API key is a server secret.

const API_BASE_URL =
  "https://q009ac7jeg.execute-api.us-east-1.amazonaws.com/v1/opt-in";
const API_TIMEOUT_MS = 10_000;
const MAX_RECORDS_GUARD = 10_000;

const MARCA_API_MAP: Record<string, string> = {
  "PEUGEOT": "FRANCE",
  "CITROEN": "FRANCE",
  "CITROËN": "FRANCE",
};

export function mapMarcaForApi(marca: string): string {
  const normalized = (marca ?? "").trim().toUpperCase();
  return MARCA_API_MAP[normalized] ?? normalized;
}

export type ExternalOptOutRecord = {
  id?: string;
  telefone_cliente?: string | null;
  cpf_cliente?: string | null;
  email_cliente?: string | null;
  marca?: string | null;
  uf?: string | null;
  [k: string]: unknown;
};

export type ExternalOptOutResponse = {
  marca?: string;
  uf?: string;
  total_registros?: number;
  dados?: ExternalOptOutRecord[];
};

export type ExternalOptOutIndex = {
  phones: Set<string>;
  emails: Set<string>;
  cpfs: Set<string>;
  totalRecords: number;
  fetchDurationMs: number;
  apiMarca: string;
};

export type CachedOptOutIndex = ExternalOptOutIndex & {
  fromCache: boolean;
  isStale: boolean;
  snapshotId: string | null;
  ageHours: number | null;
};

const FALLBACK_MAX_AGE_HOURS = 48;

function todayInSaoPaulo(): string {
  // 'en-CA' returns YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export function parseBooleanOptin(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  // Conservative: missing field = assume opt-in (does NOT block)
  return true;
}

function nullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "none" || lower === "null") return null;
  return s;
}

function buildSetsFromEntries(rows: any[]): {
  phones: Set<string>;
  emails: Set<string>;
  cpfs: Set<string>;
} {
  const phones = new Set<string>();
  const emails = new Set<string>();
  const cpfs = new Set<string>();
  for (const r of rows) {
    if (r.phone_normalized) phones.add(String(r.phone_normalized));
    if (r.email_normalized) emails.add(String(r.email_normalized));
    if (r.cpf_normalized) cpfs.add(String(r.cpf_normalized));
  }
  return { phones, emails, cpfs };
}

/**
 * Lazy daily cache by (marca_api, uf), valid for the current SP calendar day.
 * On API failure, falls back to a snapshot up to 48h old (Postura Y).
 * Throws (fail-closed) when there is no usable data.
 */
export async function getCachedOptOutIndex(params: {
  marca: string;
  uf: string;
  supabaseAdmin: any;
}): Promise<CachedOptOutIndex> {
  const { marca, uf, supabaseAdmin } = params;
  const apiMarca = mapMarcaForApi(marca);
  const normalizedUf = (uf ?? "").trim().toUpperCase();
  const todaySP = todayInSaoPaulo();

  // 1) Lookup snapshot
  const { data: snapshot, error: snapErr } = await supabaseAdmin
    .from("external_optout_snapshots")
    .select("id, status, valid_until_date_sp, fetched_at, total_records")
    .eq("marca_api", apiMarca)
    .eq("uf", normalizedUf)
    .maybeSingle();

  if (snapErr) {
    console.warn("[external-optout][cache:LOOKUP_ERROR]", {
      marca_api: apiMarca,
      uf: normalizedUf,
      error: snapErr.message,
    });
  }

  const isFresh = snapshot &&
    snapshot.status === "ready" &&
    String(snapshot.valid_until_date_sp) === todaySP;

  if (isFresh) {
    const { data: entries, error: entErr } = await supabaseAdmin
      .from("external_optout_entries")
      .select("phone_normalized, email_normalized, cpf_normalized")
      .eq("snapshot_id", snapshot.id);
    if (!entErr) {
      const sets = buildSetsFromEntries(entries ?? []);
      console.log("[external-optout][cache:HIT]", {
        marca_api: apiMarca,
        uf: normalizedUf,
        total_records: snapshot.total_records,
        valid_until_date_sp: snapshot.valid_until_date_sp,
      });
      return {
        ...sets,
        totalRecords: snapshot.total_records,
        fetchDurationMs: 0,
        apiMarca,
        fromCache: true,
        isStale: false,
        snapshotId: snapshot.id,
        ageHours: 0,
      };
    }
    console.warn("[external-optout][cache:HIT_LOAD_ERROR]", {
      marca_api: apiMarca,
      uf: normalizedUf,
      error: entErr?.message,
    });
  }

  // 2) MISS or STALE → fetch from upstream API
  const reason = !snapshot ? "no_snapshot" : "stale";
  console.log("[external-optout][cache:MISS]", {
    marca_api: apiMarca,
    uf: normalizedUf,
    reason,
  });

  try {
    const fresh = await fetchExternalOptOutIndex({ marca, uf });

    // Persist via atomic RPC (re-fetch raw to keep full columns)
    try {
      await persistSnapshot({
        supabaseAdmin,
        marca,
        uf: normalizedUf,
        apiMarca,
        todaySP,
        fetchDurationMs: fresh.fetchDurationMs,
      });
    } catch (persistErr: any) {
      // Persistence failure should NOT block the import — index is in memory.
      console.warn("[external-optout][cache:PERSIST_ERROR]", {
        marca_api: apiMarca,
        uf: normalizedUf,
        error: persistErr?.message ?? String(persistErr),
      });
    }

    return {
      ...fresh,
      fromCache: false,
      isStale: false,
      snapshotId: null,
      ageHours: null,
    };
  } catch (fetchErr: any) {
    // 3) Fetch failed → try stale snapshot ≤ 48h (Postura Y)
    if (snapshot && snapshot.status === "ready" && snapshot.fetched_at) {
      const ageMs = Date.now() - new Date(snapshot.fetched_at).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours <= FALLBACK_MAX_AGE_HOURS) {
        const { data: entries, error: entErr } = await supabaseAdmin
          .from("external_optout_entries")
          .select("phone_normalized, email_normalized, cpf_normalized")
          .eq("snapshot_id", snapshot.id);
        if (!entErr) {
          const sets = buildSetsFromEntries(entries ?? []);
          console.warn("[external-optout][cache:FALLBACK]", {
            marca_api: apiMarca,
            uf: normalizedUf,
            age_hours: Number(ageHours.toFixed(2)),
            snapshot_id: snapshot.id,
          });
          return {
            ...sets,
            totalRecords: snapshot.total_records,
            fetchDurationMs: 0,
            apiMarca,
            fromCache: true,
            isStale: true,
            snapshotId: snapshot.id,
            ageHours: Number(ageHours.toFixed(2)),
          };
        }
      }
    }
    console.error("[external-optout][cache:FAIL_CLOSED]", {
      marca_api: apiMarca,
      uf: normalizedUf,
      error_type: fetchErr?.message ?? String(fetchErr),
    });
    throw fetchErr;
  }
}

/**
 * Re-fetches the raw API payload and persists it atomically via RPC.
 * Separated from getCachedOptOutIndex to keep the in-memory index path lean.
 */
async function persistSnapshot(params: {
  supabaseAdmin: any;
  marca: string;
  uf: string;
  apiMarca: string;
  todaySP: string;
  fetchDurationMs: number;
}): Promise<void> {
  const { supabaseAdmin, marca, uf, apiMarca, todaySP, fetchDurationMs } =
    params;

  const apiKey = Deno.env.get("OPT_OUT_X_API_KEY");
  if (!apiKey) throw new Error("OPT_OUT_X_API_KEY não configurado");

  const url = new URL(API_BASE_URL_PUBLIC);
  url.searchParams.set("marca", apiMarca);
  url.searchParams.set("uf", uf);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-api-key": apiKey, "accept": "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`persist re-fetch HTTP ${response.status}`);
  }
  const json = await response.json();
  const records = Array.isArray(json?.dados) ? json.dados : [];
  if (records.length > 10_000) {
    throw new Error(`persist guard: ${records.length} records > 10000`);
  }

  const originalMarca = (marca ?? "").trim().toUpperCase();
  const entries: any[] = [];
  for (const r of records) {
    const recMarca = (r?.marca ?? "").toString().trim().toUpperCase() ||
      "TODAS";
    const recUf = (r?.uf ?? "").toString().trim().toUpperCase() || "TODAS";
    const appliesMarca = recMarca === apiMarca || recMarca === originalMarca ||
      recMarca === "TODAS";
    const appliesUf = recUf === uf || recUf === "TODAS";
    if (!appliesMarca || !appliesUf) continue;

    entries.push({
      phone_normalized: normalizePhone(r?.telefone_cliente),
      email_normalized: normalizeEmail(r?.email_cliente),
      cpf_normalized: normalizeCpf(r?.cpf_cliente),
      api_id: nullableString(r?.id),
      data_inicio: nullableString(r?.data_inicio),
      data_conclusao: nullableString(r?.data_conclusao),
      email_solicitante: nullableString(r?.email_solicitante),
      nome_abreviado_cliente: nullableString(r?.nome_abreviado_cliente),
      nome_completo_cliente: nullableString(r?.nome_completo_cliente),
      telefone_cliente: nullableString(r?.telefone_cliente),
      cpf_cliente: nullableString(r?.cpf_cliente),
      email_cliente: nullableString(r?.email_cliente),
      canal_solicitado_do_cliente: nullableString(
        r?.canal_solicitado_do_cliente,
      ),
      nome_solicitante: nullableString(r?.nome_solicitante),
      telefone_solicitante: nullableString(r?.telefone_solicitante),
      cargo_solicitante: nullableString(r?.cargo_solicitante),
      departamento_solicitante: nullableString(r?.departamento_solicitante),
      marca: nullableString(r?.marca),
      uf_original: nullableString(r?.uf),
      call_optin: parseBooleanOptin(r?.call_optin),
      email_optin: parseBooleanOptin(r?.email_optin),
      sms_optin: parseBooleanOptin(r?.sms_optin),
      whatsapp_optin: parseBooleanOptin(r?.whatsapp_optin),
      pesquisa_optin: parseBooleanOptin(r?.pesquisa_optin),
    });
  }

  const { data: snapshotId, error } = await supabaseAdmin.rpc(
    "upsert_external_optout_snapshot",
    {
      p_marca_api: apiMarca,
      p_uf: uf,
      p_today_sp: todaySP,
      p_fetch_duration_ms: fetchDurationMs,
      p_total_records: records.length,
      p_entries: entries,
    },
  );
  if (error) throw new Error(error.message);
  console.log("[external-optout][cache:PERSISTED]", {
    marca_api: apiMarca,
    uf,
    total_records: records.length,
    snapshot_id: snapshotId,
  });
}

// Public alias used by persistSnapshot's re-fetch (keeps single source of URL)
const API_BASE_URL_PUBLIC = API_BASE_URL;

function isNullish(value?: string | null): boolean {
  if (value == null) return true;
  const v = String(value).trim().toLowerCase();
  return v === "" || v === "none" || v === "null";
}

export function normalizePhone(value?: string | null): string | null {
  if (isNullish(value)) return null;
  let digits = String(value).replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  // 1) Strip country code 55 when present on 12/13-digit numbers
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // 2) Strip the 9th digit for mobile numbers (project convention)
  //    Mobile = 11 digits where the 3rd char is "9" (DDD + 9 + 8 digits).
  //    Normalize to 10-digit form: DDD + 8 digits.
  if (digits.length === 11 && digits[2] === "9") {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  return digits;
}

export function normalizeEmail(value?: string | null): string | null {
  if (isNullish(value)) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized.includes("@")) return null;
  return normalized;
}

export function normalizeCpf(value?: string | null): string | null {
  if (isNullish(value)) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

export async function fetchExternalOptOutIndex(params: {
  marca: string;
  uf: string;
}): Promise<ExternalOptOutIndex> {
  const { marca, uf } = params;

  const apiKey = Deno.env.get("OPT_OUT_X_API_KEY");
  if (!apiKey) {
    throw new Error("OPT_OUT_X_API_KEY não configurado");
  }

  const apiMarca = mapMarcaForApi(marca);
  const normalizedUf = (uf ?? "").trim().toUpperCase();
  if (!apiMarca || !normalizedUf) {
    throw new Error(
      `Parâmetros inválidos para opt-out externo (marca='${marca}', uf='${uf}')`,
    );
  }

  const url = new URL(API_BASE_URL);
  url.searchParams.set("marca", apiMarca);
  url.searchParams.set("uf", normalizedUf);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const startMs = Date.now();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "accept": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(
        `API opt-out externo: timeout após ${API_TIMEOUT_MS}ms para ${apiMarca}/${normalizedUf}`,
      );
    }
    throw new Error(
      `API opt-out externo: erro de rede — ${err?.message ?? String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const fetchDurationMs = Date.now() - startMs;

  if (!response.ok) {
    throw new Error(
      `API opt-out externo retornou HTTP ${response.status} para ${apiMarca}/${normalizedUf}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("API opt-out externo: resposta não é JSON válido");
  }

  const typed = json as ExternalOptOutResponse;
  if (!typed || !Array.isArray(typed.dados)) {
    throw new Error(
      "API opt-out externo: formato inesperado (campo 'dados' ausente ou não é array)",
    );
  }

  const records = typed.dados;
  if (records.length > MAX_RECORDS_GUARD) {
    throw new Error(
      `API opt-out externo retornou ${records.length} registros — ` +
        `volume acima do limite de segurança (${MAX_RECORDS_GUARD}). Abortando.`,
    );
  }

  const phones = new Set<string>();
  const emails = new Set<string>();
  const cpfs = new Set<string>();

  const originalMarca = (marca ?? "").trim().toUpperCase();

  for (const record of records) {
    // Treat null/empty marca/uf in the record as "TODAS" (conservative).
    const recordMarca = (record?.marca ?? "").toString().trim().toUpperCase() ||
      "TODAS";
    const recordUf = (record?.uf ?? "").toString().trim().toUpperCase() ||
      "TODAS";

    const appliesToMarca =
      recordMarca === apiMarca ||
      recordMarca === originalMarca ||
      recordMarca === "TODAS";

    const appliesToUf =
      recordUf === normalizedUf ||
      recordUf === "TODAS";

    if (!appliesToMarca || !appliesToUf) continue;

    const phone = normalizePhone(record?.telefone_cliente);
    const email = normalizeEmail(record?.email_cliente);
    const cpf = normalizeCpf(record?.cpf_cliente);

    if (phone) phones.add(phone);
    if (email) emails.add(email);
    if (cpf) cpfs.add(cpf);
  }

  return {
    phones,
    emails,
    cpfs,
    totalRecords: records.length,
    fetchDurationMs,
    apiMarca,
  };
}

export function isBlockedByExternalOptOut(
  contato: {
    telefone?: string | null;
    email?: string | null;
    cpf?: string | null;
    documento?: string | null;
  },
  index: ExternalOptOutIndex,
  _options?: { channel?: "whatsapp" | "email" | "sms" | "call" | "all" },
): boolean {
  // V1: ignores channel; blocks if any identifier matches the list.
  if (
    index.phones.size === 0 &&
    index.emails.size === 0 &&
    index.cpfs.size === 0
  ) {
    return false;
  }

  const phone = normalizePhone(contato.telefone);
  if (phone && index.phones.has(phone)) return true;

  const email = normalizeEmail(contato.email);
  if (email && index.emails.has(email)) return true;

  const cpf1 = normalizeCpf(contato.cpf);
  if (cpf1 && index.cpfs.has(cpf1)) return true;

  const cpf2 = normalizeCpf(contato.documento);
  if (cpf2 && index.cpfs.has(cpf2)) return true;

  return false;
}
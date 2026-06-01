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
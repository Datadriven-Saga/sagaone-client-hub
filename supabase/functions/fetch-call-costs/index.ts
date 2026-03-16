import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Summary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  twilioCost: number;
  vapiCost: number;
  twilioCount: number;
  vapiCount: number;
  errorCount: number;
  isPartial: boolean;
}

interface RequestPayload {
  phone: string;
  startDate: string;
  endDate: string;
  source: "twilio" | "vapi" | "unified";
}



function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function encodeBasicAuth(username: string, password: string): string {
  const data = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  data.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function parsePayload(req: Request): Promise<RequestPayload> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    return {
      phone: url.searchParams.get("phone") ?? "",
      startDate: url.searchParams.get("startDate") ?? "",
      endDate: url.searchParams.get("endDate") ?? "",
      source: ((url.searchParams.get("source") ?? "unified") as RequestPayload["source"]),
    };
  }

  const body = await req.json();
  return {
    phone: body?.phone ?? "",
    startDate: body?.startDate ?? "",
    endDate: body?.endDate ?? "",
    source: (body?.source ?? "unified") as RequestPayload["source"],
  };
}

async function fetchTwilioAggregated(
  startDate: string,
  endDate: string,
  summary: Summary,
  dailyCosts: Record<string, { twilio: number; vapi: number }>,
): Promise<string[]> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  const warnings: string[] = [];

  if (!sid || !token) {
    warnings.push("Twilio: credenciais não configuradas");
    return warnings;
  }

  const auth = encodeBasicAuth(sid, token);

  try {
    const usageParams = new URLSearchParams({
      StartDate: startDate,
      EndDate: endDate,
      Category: "calls",
    });

    const usageUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records/Daily.json?${usageParams.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let res: Response;

    try {
      res = await fetch(usageUrl, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio Usage API [${res.status}]: ${text}`);
    }

    const data = await res.json();
    const records = data.usage_records || [];

    for (const record of records) {
      const cost = Math.abs(parseFloat(record.price || "0"));
      const count = parseInt(record.count || "0", 10);
      const dateStr = record.start_date || "";

      summary.twilioCount += count;
      summary.twilioCost += cost;
      summary.totalCalls += count;
      summary.totalCost += cost;

      if (dateStr) {
        if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { twilio: 0, vapi: 0 };
        dailyCosts[dateStr].twilio += cost;
      }
    }

    console.log(`Twilio Usage Records: ${records.length} days, ${summary.twilioCount} calls, $${summary.twilioCost.toFixed(4)}`);
  } catch (e: any) {
    warnings.push(`Twilio: ${e?.message || "erro inesperado"}`);
    console.error("Twilio Usage error:", e);
  }

  return warnings;
}

async function resolveVapiPhoneIds(apiKey: string, phoneDigits: string): Promise<string[]> {
  if (!phoneDigits) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.vapi.ai/phone-number", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const phones = await res.json();
    const list = Array.isArray(phones) ? phones : phones.results || phones.data || [];
    const ids: string[] = [];

    for (const p of list) {
      const digits = normalizeDigits(p.number || p.twilioPhoneNumber || "");
      if (!digits) continue;
      if (digits.includes(phoneDigits) || phoneDigits.includes(digits)) ids.push(p.id);
    }

    return ids;
  } catch {
    return [];
  }
}

async function syncVapiWindowToCache(
  apiKey: string,
  supabase: any,
  startIso: string,
  endIso: string,
  phoneIds: string[],
  warnings: string[],
): Promise<void> {
  const targets = phoneIds.length > 0 ? phoneIds : [null];

  for (const pid of targets) {
    let cursor: string | null = null;
    let pageNum = 0;
    const cacheBatch: any[] = [];

    while (true) {
      pageNum++;
      const params = new URLSearchParams();
      params.set("createdAtGe", startIso);
      params.set("createdAtLe", endIso);
      params.set("limit", "100");
      if (pid) params.set("phoneNumberId", pid);
      if (cursor) params.set("createdAtLt", cursor);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          warnings.push(`Vapi [${res.status}]: ${text.substring(0, 120)}`);
          break;
        }

        const rawData = await res.json();
        const rawCalls: any[] = Array.isArray(rawData) ? rawData : rawData.results || rawData.data || [];
        if (rawCalls.length === 0) break;

        let lastDate: string | null = null;

        for (const call of rawCalls) {
          lastDate = call.createdAt || lastDate;

          const costVal = call.cost ?? call.costBreakdown?.total ?? 0;
          const cost = typeof costVal === "number" ? costVal : parseFloat(costVal || "0");
          const duration = call.endedAt && call.startedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
            : call.duration || 0;
          const cb = call.costBreakdown || {};
          const metaOnly = call.metadata || call.assistantOverrides?.metadata;

          cacheBatch.push({
            call_id: call.id,
            assistant_id: call.assistantId || call.assistant?.id || null,
            phone_number_id: call.phoneNumberId || call.phoneNumber?.id || null,
            customer_number: call.customer?.number || call.customer?.name || "—",
            agent_phone: call.phoneNumber?.number || call.phoneNumber?.twilioPhoneNumber || null,
            duration,
            cost,
            status: call.status || call.endedReason || "unknown",
            started_at: call.startedAt || call.createdAt || null,
            cost_stt: parseFloat(cb.stt || "0"),
            cost_llm: parseFloat(cb.llm || "0"),
            cost_tts: parseFloat(cb.tts || "0"),
            cost_transport: parseFloat(cb.transport || "0"),
            cost_vapi: parseFloat(cb.vapi || "0"),
            raw_data: metaOnly ? { metadata: metaOnly } : null,
            synced_at: new Date().toISOString(),
          });

          if (cacheBatch.length >= 200) {
            const batch = cacheBatch.splice(0, cacheBatch.length);
            const { error } = await supabase.from("vapi_calls_cache").upsert(batch, {
              onConflict: "call_id",
              ignoreDuplicates: false,
            });
            if (error) warnings.push(`Vapi cache upsert: ${error.message}`);
          }
        }

        console.log(`Vapi sync p${pageNum}: ${rawCalls.length} chamadas (${pid || "all"})`);

        if (rawCalls.length < 100 || !lastDate || lastDate === cursor) break;
        cursor = lastDate;
      } catch (e: any) {
        warnings.push(`Vapi sync p${pageNum}: ${e.message}`);
        break;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (cacheBatch.length > 0) {
      const { error } = await supabase.from("vapi_calls_cache").upsert(cacheBatch, {
        onConflict: "call_id",
        ignoreDuplicates: false,
      });
      if (error) warnings.push(`Vapi cache upsert final: ${error.message}`);
    }
  }
}

async function fetchVapiAggregated(
  phone: string,
  startDate: string,
  endDate: string,
  summary: Summary,
  dailyCosts: Record<string, { twilio: number; vapi: number }>,
): Promise<string[]> {
  const warnings: string[] = [];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return ["Supabase service role não configurada para leitura do cache Vapi"];
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const apiKey = Deno.env.get("VAPI_API_KEY") || "";
  const phoneDigits = normalizeDigits(phone || "");

  const startObj = new Date(`${startDate}T00:00:00`);
  const endObj = new Date(`${endDate}T23:59:59`);
  if (startObj > endObj) {
    warnings.push("Vapi: período inválido.");
    return warnings;
  }

  const startIso = startObj.toISOString();
  const endIso = endObj.toISOString();

  const retentionStart = new Date();
  retentionStart.setDate(retentionStart.getDate() - 14);
  retentionStart.setHours(0, 0, 0, 0);

  let phoneIds: string[] = [];
  if (phoneDigits && apiKey) {
    phoneIds = await resolveVapiPhoneIds(apiKey, phoneDigits);
    if (phoneIds.length === 0) {
      warnings.push(`Vapi: telefone ${phone} não encontrado na conta.`);
    }
  }

  if (!apiKey) {
    warnings.push("Vapi: API key ausente. Exibindo dados apenas do cache local.");
  } else {
    const syncStartBase = startObj < retentionStart ? retentionStart : startObj;
    if (syncStartBase <= endObj) {
      let syncStartIso = syncStartBase.toISOString();

      const { data: latestCached } = await supabase
        .from("vapi_calls_cache")
        .select("started_at")
        .gte("started_at", syncStartIso)
        .lte("started_at", endIso)
        .order("started_at", { ascending: false })
        .limit(1);

      if (latestCached?.[0]?.started_at) {
        const rewind = new Date(latestCached[0].started_at);
        rewind.setMinutes(rewind.getMinutes() - 30);
        if (rewind > syncStartBase) syncStartIso = rewind.toISOString();
      }

      await syncVapiWindowToCache(apiKey, supabase, syncStartIso, endIso, phoneIds, warnings);
    }
  }

  const CACHE_PAGE_SIZE = 2000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("vapi_calls_cache")
      .select("cost,duration,status,started_at,agent_phone,phone_number_id")
      .gte("started_at", startIso)
      .lte("started_at", endIso)
      .order("started_at", { ascending: true })
      .range(from, from + CACHE_PAGE_SIZE - 1);

    if (phoneIds.length > 0) {
      query = query.in("phone_number_id", phoneIds);
    }

    const { data, error } = await query;
    if (error) {
      warnings.push(`Vapi cache query: ${error.message}`);
      break;
    }

    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (phoneDigits && phoneIds.length === 0) {
        const rowDigits = normalizeDigits(row.agent_phone || "");
        if (!rowDigits.includes(phoneDigits) && !phoneDigits.includes(rowDigits)) continue;
      }

      const cost = typeof row.cost === "number" ? row.cost : parseFloat(String(row.cost || "0"));
      const duration = Number(row.duration || 0);
      const status = String(row.status || "");
      const isFailed = status.includes("error") || status.includes("failed");

      summary.totalCalls++;
      summary.totalCost += cost;
      summary.totalDuration += duration;
      summary.vapiCount++;
      summary.vapiCost += cost;
      if (isFailed) summary.errorCount++;

      const dateStr = String(row.started_at || "").substring(0, 10);
      if (dateStr) {
        if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { twilio: 0, vapi: 0 };
        dailyCosts[dateStr].vapi += cost;
      }
    }

    if (rows.length < CACHE_PAGE_SIZE) break;
    from += CACHE_PAGE_SIZE;
  }

  console.log(`Vapi CACHE DONE: ${summary.vapiCount} calls, $${summary.vapiCost.toFixed(4)}`);
  return warnings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { phone, startDate, endDate, source } = await parsePayload(req);

    if (!startDate || !endDate) {
      return jsonResponse({ error: "startDate and endDate are required", warnings: [], summary: null, dailyCosts: {} }, 400);
    }

    const summary: Summary = {
      totalCalls: 0,
      totalCost: 0,
      totalDuration: 0,
      twilioCost: 0,
      vapiCost: 0,
      twilioCount: 0,
      vapiCount: 0,
      errorCount: 0,
      isPartial: false,
    };

    const dailyCosts: Record<string, { twilio: number; vapi: number }> = {};
    const warnings: string[] = [];

    if (source === "twilio" || source === "unified") {
      warnings.push(...await fetchTwilioAggregated(startDate, endDate, summary, dailyCosts));
    }

    if (source === "vapi" || source === "unified") {
      warnings.push(...await fetchVapiAggregated(phone || "", startDate, endDate, summary, dailyCosts));
    }

    console.log("=== FINAL ===");
    console.log(`Twilio: ${summary.twilioCount} ($${summary.twilioCost.toFixed(4)}) | Vapi: ${summary.vapiCount} ($${summary.vapiCost.toFixed(4)})`);
    console.log(`TOTAL: ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)} | Partial: ${summary.isPartial}`);

    return jsonResponse({ warnings, summary, dailyCosts });
  } catch (error: any) {
    console.error("fetch-call-costs error:", error);
    const message = error?.message || "Erro inesperado";
    return jsonResponse({
      error: message,
      warnings: [message],
      summary: null,
      dailyCosts: {},
    });
  }
});

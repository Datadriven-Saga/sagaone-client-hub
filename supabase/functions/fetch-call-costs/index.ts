import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CallRecord {
  id: string;
  phoneFrom: string;
  phoneTo: string;
  duration: number;
  cost: number;
  source: "twilio" | "vapi";
  date: string;
  status?: string;
}

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function tryTwilioWithCredentials(
  sid: string, token: string, phone: string, startDate: string, endDate: string
): Promise<CallRecord[]> {
  const auth = btoa(`${sid}:${token}`);
  const phoneDigits = normalizeDigits(phone);
  const calls: CallRecord[] = [];
  let nextPageUrl: string | null = null;
  const maxPages = 20;

  const params = new URLSearchParams();
  params.set("StartTime>", startDate);
  params.set("EndTime<", endDate);
  params.set("PageSize", "1000");
  nextPageUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?${params.toString()}`;

  for (let pageNum = 0; pageNum < maxPages && nextPageUrl; pageNum++) {
    console.log(`Twilio page ${pageNum + 1}`);
    const res = await fetch(nextPageUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio API error [${res.status}]: ${text}`);
    }

    const data = await res.json();
    const pageCalls = data.calls || [];

    for (const call of pageCalls) {
      const from = call.from || "";
      const to = call.to || "";
      const matchesPhone = !phoneDigits || 
        normalizeDigits(from).includes(phoneDigits) || 
        normalizeDigits(to).includes(phoneDigits);
      if (!matchesPhone) continue;

      calls.push({
        id: call.sid,
        phoneFrom: from,
        phoneTo: to,
        duration: parseInt(call.duration || "0", 10),
        cost: Math.abs(parseFloat(call.price || "0")),
        source: "twilio",
        date: call.start_time || call.date_created,
      });
    }

    // Twilio provides next_page_uri for pagination
    nextPageUrl = data.next_page_uri 
      ? `https://api.twilio.com${data.next_page_uri}` 
      : null;
  }

  return calls;
}

function validateTwilioSid(sid: string): boolean {
  return /^AC[0-9a-fA-F]{32}$/.test(sid);
}

async function fetchTwilioCalls(phone: string, startDate: string, endDate: string): Promise<CallRecord[]> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  
  if (!sid || !token) {
    throw new Error("Twilio credentials not configured - set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  }

  console.log(`Twilio DEBUG: SID starts="${sid.substring(0, 4)}", len=${sid.length}, token_len=${token.length}`);

  if (!validateTwilioSid(sid)) {
    throw new Error(`Twilio SID invalid format: starts with "${sid.substring(0, 4)}", length=${sid.length}. Must start with 'AC' followed by 32 hex characters`);
  }

  const result = await tryTwilioWithCredentials(sid, token, phone, startDate, endDate);
  console.log(`Twilio: ${result.length} calls found`);
  return result;
}

async function fetchVapiPage(apiKey: string, params: URLSearchParams, signal?: AbortSignal): Promise<any[]> {
  const url = `https://api.vapi.ai/call?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API error [${res.status}]: ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || data.data || [];
}

// Resolve phone digits to Vapi phoneNumberId(s)
async function resolveVapiPhoneNumberIds(apiKey: string, phoneDigits: string): Promise<string[]> {
  if (!phoneDigits) return [];
  
  const res = await fetch("https://api.vapi.ai/phone-number", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error("Vapi phone-number list failed:", res.status);
    return [];
  }
  const phones = await res.json();
  const list = Array.isArray(phones) ? phones : phones.results || [];
  
  const matched: string[] = [];
  for (const p of list) {
    const num = p.number || p.twilioPhoneNumber || "";
    const digits = normalizeDigits(num);
    if (digits.includes(phoneDigits) || phoneDigits.includes(digits)) {
      matched.push(p.id);
      console.log(`Vapi phone resolved: ${num} -> ${p.id}`);
    }
  }
  return matched;
}

function parseVapiCall(call: any): CallRecord {
  const endedReason = call.endedReason || "";
  const isFailed = endedReason.includes("error") || endedReason.includes("failed");
  const fromNumber = call.phoneNumber?.number || call.phoneNumber?.twilioPhoneNumber || "";
  const customerNumber = call.customer?.number || "";

  const durationSec = call.endedAt && call.startedAt
    ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    : call.duration || 0;
  const costVal = call.cost ?? call.costBreakdown?.total ?? 0;

  return {
    id: call.id,
    phoneFrom: fromNumber || call.phoneNumberId || "",
    phoneTo: customerNumber,
    duration: durationSec,
    cost: typeof costVal === "number" ? costVal : parseFloat(costVal || "0"),
    source: "vapi",
    date: call.startedAt || call.createdAt,
    status: isFailed ? `erro: ${endedReason}` : (call.status || "completed"),
  };
}

async function fetchVapiCallsForPhoneId(
  apiKey: string, phoneNumberId: string, startIso: string, endIso: string, deadline: number
): Promise<{ calls: CallRecord[]; truncated: boolean }> {
  const calls: CallRecord[] = [];
  let cursor: string | null = null;
  const maxPages = 10;
  let truncated = false;

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    if (Date.now() > deadline) {
      truncated = true;
      console.log(`Vapi: deadline reached at page ${pageNum + 1}, returning ${calls.length} calls`);
      break;
    }

    const params = new URLSearchParams();
    params.set("createdAtGe", startIso);
    params.set("createdAtLe", endIso);
    params.set("phoneNumberId", phoneNumberId);
    params.set("limit", "1000");
    if (cursor) params.set("createdAtLt", cursor);

    try {
      const rawCalls = await fetchVapiPage(apiKey, params);
      console.log(`Vapi page ${pageNum + 1}: ${rawCalls.length} calls`);
      for (const call of rawCalls) calls.push(parseVapiCall(call));

      if (rawCalls.length < 1000) break;
      const lastDate = rawCalls[rawCalls.length - 1]?.createdAt;
      if (!lastDate || lastDate === cursor) break;
      cursor = lastDate;
    } catch (e) {
      console.error(`Vapi page ${pageNum + 1} error:`, e.message);
      truncated = true;
      break;
    }
  }
  return { calls, truncated };
}

interface VapiResult {
  calls: CallRecord[];
  warnings: string[];
}

async function fetchVapiCalls(phone: string, startDate: string, endDate: string): Promise<VapiResult> {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) throw new Error("VAPI_API_KEY not configured");

  const startIso = new Date(startDate).toISOString();
  const endIso = new Date(endDate + "T23:59:59").toISOString();
  const phoneDigits = normalizeDigits(phone);
  const deadline = Date.now() + 25_000; // 25s budget to leave room for response
  const warnings: string[] = [];

  if (phoneDigits) {
    const phoneIds = await resolveVapiPhoneNumberIds(apiKey, phoneDigits);
    if (phoneIds.length === 0) {
      console.log(`Vapi: no phoneNumberId found for "${phoneDigits}"`);
      return { calls: [], warnings: [`Vapi: telefone ${phone} não encontrado nos números cadastrados`] };
    }
    
    const allCalls: CallRecord[] = [];
    for (const pid of phoneIds) {
      console.log(`Vapi fetching for phoneNumberId: ${pid}`);
      const result = await fetchVapiCallsForPhoneId(apiKey, pid, startIso, endIso, deadline);
      allCalls.push(...result.calls);
      if (result.truncated) {
        warnings.push(`Vapi: resultado parcial (${allCalls.length} chamadas carregadas, pode haver mais). Reduza o período para ver todos.`);
      }
      console.log(`Vapi ${pid}: ${result.calls.length} calls${result.truncated ? " (truncated)" : ""}`);
    }
    
    const errors = allCalls.filter(c => c.status?.startsWith("erro")).length;
    console.log(`Vapi total: ${allCalls.length}, errors: ${errors}`);
    return { calls: allCalls, warnings };
  }

  // No phone filter
  const calls: CallRecord[] = [];
  let cursor: string | null = null;
  for (let pageNum = 0; pageNum < 10; pageNum++) {
    if (Date.now() > deadline) {
      warnings.push(`Vapi: resultado parcial (${calls.length} chamadas). Selecione um telefone específico.`);
      break;
    }
    const params = new URLSearchParams();
    params.set("createdAtGe", startIso);
    params.set("createdAtLe", endIso);
    params.set("limit", "1000");
    if (cursor) params.set("createdAtLt", cursor);

    try {
      const rawCalls = await fetchVapiPage(apiKey, params);
      for (const call of rawCalls) calls.push(parseVapiCall(call));
      if (rawCalls.length < 1000) break;
      const lastDate = rawCalls[rawCalls.length - 1]?.createdAt;
      if (!lastDate || lastDate === cursor) break;
      cursor = lastDate;
    } catch (e) {
      warnings.push(`Vapi: erro na página ${pageNum + 1}, resultado parcial`);
      break;
    }
  }
  
  console.log(`Vapi total (no filter): ${calls.length}`);
  return { calls, warnings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, startDate, endDate, source } = await req.json();

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results: CallRecord[] = [];
    const warnings: string[] = [];

    if (source === "twilio" || source === "unified") {
      try {
        const twilioCalls = await fetchTwilioCalls(phone || "", startDate, endDate);
        results = results.concat(twilioCalls);
      } catch (e) {
        console.error("Twilio fetch error:", e);
        warnings.push(`Twilio: ${e.message}`);
      }
    }

    if (source === "vapi" || source === "unified") {
      try {
        const vapiResult = await fetchVapiCalls(phone || "", startDate, endDate);
        results = results.concat(vapiResult.calls);
        warnings.push(...vapiResult.warnings);
      } catch (e) {
        console.error("Vapi fetch error:", e);
        warnings.push(`Vapi: ${e.message}`);
      }
    }

    // Sort by date desc
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Compute summary from ALL results
    const totalCost = results.reduce((s, c) => s + c.cost, 0);
    const totalDuration = results.reduce((s, c) => s + c.duration, 0);
    const twilioCost = results.filter(c => c.source === "twilio").reduce((s, c) => s + c.cost, 0);
    const vapiCost = results.filter(c => c.source === "vapi").reduce((s, c) => s + c.cost, 0);
    const errorCount = results.filter(c => c.status?.startsWith("erro")).length;
    
    const summary = {
      totalCalls: results.length,
      totalCost,
      totalDuration,
      twilioCost,
      vapiCost,
      errorCount,
    };

    // Limit returned records to keep response size manageable
    const MAX_RECORDS = 500;
    const truncatedCalls = results.slice(0, MAX_RECORDS);
    if (results.length > MAX_RECORDS) {
      warnings.push(`Mostrando ${MAX_RECORDS} de ${results.length} chamadas. Reduza o período para ver todas.`);
    }

    return new Response(JSON.stringify({ calls: truncatedCalls, warnings, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-call-costs error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error", calls: [], warnings: [error.message] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

interface Summary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  twilioCost: number;
  vapiCost: number;
  twilioCount: number;
  vapiCount: number;
  errorCount: number;
  pagesProcessed: number;
  callsWithoutPrice: number;
  callsNegativePrice: number;
  isPartial: boolean;
}

const MAX_DISPLAY = 50;
const MAX_PAGES = 5;

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function encodeBasicAuth(username: string, password: string): string {
  const data = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  data.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function validateTwilioSid(sid: string): boolean {
  return /^AC[0-9a-fA-F]{32}$/.test(sid);
}

// ========== TWILIO: STREAMING AGGREGATION ==========
async function streamTwilioCalls(
  phone: string, startDate: string, endDate: string,
  summary: Summary, recentCalls: CallRecord[], dailyCosts: Record<string, { twilio: number; vapi: number }>, deadline: number
): Promise<string[]> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  const warnings: string[] = [];

  if (!sid || !token) throw new Error("Twilio credentials not configured");
  if (!validateTwilioSid(sid)) throw new Error("Twilio SID invalid format");

  const auth = encodeBasicAuth(sid, token);
  const phoneDigits = normalizeDigits(phone);

  const params = new URLSearchParams();
  params.set("StartTime>=", `${startDate}T00:00:00Z`);
  params.set("StartTime<=", `${endDate}T23:59:59Z`);
  params.set("PageSize", "1000");
  let nextPageUrl: string | null = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?${params.toString()}`;
  let pagesUsed = 0;

  while (nextPageUrl) {
    if (Date.now() > deadline || pagesUsed >= MAX_PAGES) {
      summary.isPartial = true;
      warnings.push(`Twilio: resultado parcial (${summary.twilioCount} chamadas). Reduza o período ou use filtro de telefone.`);
      break;
    }

    pagesUsed++;
    summary.pagesProcessed++;
    const res = await fetch(nextPageUrl, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio API error [${res.status}]: ${text}`);
    }

    const data = await res.json();
    const pageCalls = data.calls || [];
    let pageCost = 0;
    let pageMatched = 0;

    for (const call of pageCalls) {
      const from = call.from || "";
      const to = call.to || "";
      if (phoneDigits && !normalizeDigits(from).includes(phoneDigits) && !normalizeDigits(to).includes(phoneDigits)) continue;

      const cost = Math.abs(parseFloat(call.price || "0"));
      const duration = parseInt(call.duration || "0", 10);
      pageCost += cost;
      pageMatched++;

      summary.totalCalls++;
      summary.totalCost += cost;
      summary.totalDuration += duration;
      summary.twilioCount++;
      summary.twilioCost += cost;
      if (cost === 0 && duration > 0) summary.callsWithoutPrice++;
      if (cost < 0) summary.callsNegativePrice++;

      if (recentCalls.length < MAX_DISPLAY) {
        recentCalls.push({
          id: call.sid, phoneFrom: from, phoneTo: to,
          duration, cost, source: "twilio",
          date: call.start_time || call.date_created,
        });
      }
    }

    console.log(`Twilio p${summary.pagesProcessed}: +${pageMatched} matched, $${pageCost.toFixed(2)}, total=${summary.twilioCount}`);

    // Follow pagination
    nextPageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;

    // Release page memory explicitly
    // deno-lint-ignore no-explicit-any
    (data as any).calls = null;
  }

  console.log(`Twilio DONE: ${summary.twilioCount} calls, $${summary.twilioCost.toFixed(4)}`);
  return warnings;
}

// ========== VAPI: STREAMING AGGREGATION ==========
async function streamVapiCalls(
  phone: string, startDate: string, endDate: string,
  summary: Summary, recentCalls: CallRecord[], deadline: number
): Promise<string[]> {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) throw new Error("VAPI_API_KEY not configured");
  const warnings: string[] = [];

  // 14-day retention clamp
  const minAllowed = new Date();
  minAllowed.setDate(minAllowed.getDate() - 14);
  minAllowed.setHours(0, 0, 0, 0);

  let effStart = new Date(startDate);
  if (effStart < minAllowed) {
    effStart = minAllowed;
    warnings.push(`Vapi: dados limitados aos últimos 14 dias (a partir de ${effStart.toISOString().split("T")[0]}).`);
  }

  const endObj = new Date(endDate + "T23:59:59");
  if (effStart > endObj) {
    warnings.push("Vapi: período fora da janela de retenção.");
    return warnings;
  }

  const startIso = effStart.toISOString();
  const endIso = endObj.toISOString();
  const phoneDigits = normalizeDigits(phone);

  // Resolve phone IDs
  let phoneIds: string[] = [];
  if (phoneDigits) {
    const res = await fetch("https://api.vapi.ai/phone-number", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) {
      const phones = await res.json();
      const list = Array.isArray(phones) ? phones : phones.results || [];
      for (const p of list) {
        const digits = normalizeDigits(p.number || p.twilioPhoneNumber || "");
        if (digits.includes(phoneDigits) || phoneDigits.includes(digits)) {
          phoneIds.push(p.id);
          console.log(`Vapi phone resolved: ${p.number || p.twilioPhoneNumber} -> ${p.id}`);
        }
      }
    }
    if (phoneIds.length === 0) {
      warnings.push(`Vapi: telefone ${phone} não encontrado`);
      return warnings;
    }
  }

  const idsToFetch = phoneIds.length > 0 ? phoneIds : [null];

  for (const pid of idsToFetch) {
    let cursor: string | null = null;
    let pageNum = 0;

    while (true) {
      if (Date.now() > deadline) {
        summary.isPartial = true;
        warnings.push(`Vapi: resultado parcial (${summary.vapiCount} chamadas). Reduza o período.`);
        return warnings;
      }

      pageNum++;
      summary.pagesProcessed++;
      const params = new URLSearchParams();
      params.set("createdAtGe", startIso);
      params.set("createdAtLe", endIso);
      params.set("limit", "100");
      if (pid) params.set("phoneNumberId", pid);
      if (cursor) params.set("createdAtLt", cursor);

      try {
        const url = `https://api.vapi.ai/call?${params.toString()}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let res: Response;
        try {
          res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Vapi [${res.status}]: ${text}`);
        }
        const rawData = await res.json();
        const rawCalls = Array.isArray(rawData) ? rawData : rawData.results || rawData.data || [];
        let pageCost = 0;

        for (const call of rawCalls) {
          const endedReason = call.endedReason || "";
          const isFailed = endedReason.includes("error") || endedReason.includes("failed");
          const costVal = call.cost ?? call.costBreakdown?.total ?? 0;
          const cost = typeof costVal === "number" ? costVal : parseFloat(costVal || "0");
          const duration = call.endedAt && call.startedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
            : call.duration || 0;

          pageCost += cost;
          summary.totalCalls++;
          summary.totalCost += cost;
          summary.totalDuration += duration;
          summary.vapiCount++;
          summary.vapiCost += cost;
          if (isFailed) summary.errorCount++;
          if (cost === 0 && duration > 0) summary.callsWithoutPrice++;
          if (cost < 0) summary.callsNegativePrice++;

          if (recentCalls.length < MAX_DISPLAY) {
            recentCalls.push({
              id: call.id,
              phoneFrom: call.phoneNumber?.number || call.phoneNumberId || "",
              phoneTo: call.customer?.number || "",
              duration, cost, source: "vapi",
              date: call.startedAt || call.createdAt,
              status: isFailed ? `erro: ${endedReason}` : (call.status || "completed"),
            });
          }
        }

        console.log(`Vapi p${pageNum}${pid ? ` (${pid.substring(0,8)})` : ""}: ${rawCalls.length}, $${pageCost.toFixed(2)}, total=${summary.vapiCount}`);

        if (rawCalls.length < 100) break;
        const lastDate = rawCalls[rawCalls.length - 1]?.createdAt;
        if (!lastDate || lastDate === cursor) break;
        cursor = lastDate;

        // Limit total pages to avoid timeout
        if (pageNum >= 10) {
          summary.isPartial = true;
          warnings.push(`Vapi: resultado parcial (${summary.vapiCount} chamadas).`);
          break;
        }
      } catch (e) {
        warnings.push(`Vapi: erro p${pageNum}: ${e.message}`);
        break;
      }
    }
  }

  console.log(`Vapi DONE: ${summary.vapiCount} calls, $${summary.vapiCost.toFixed(4)}`);
  return warnings;
}

// ========== MAIN ==========
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, startDate, endDate, source } = await req.json();
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 50s budget total — run SEQUENTIALLY to minimize memory
    const deadline = Date.now() + 50_000;
    const summary: Summary = {
      totalCalls: 0, totalCost: 0, totalDuration: 0,
      twilioCost: 0, vapiCost: 0, twilioCount: 0, vapiCount: 0,
      errorCount: 0, pagesProcessed: 0,
      callsWithoutPrice: 0, callsNegativePrice: 0, isPartial: false,
    };
    const recentCalls: CallRecord[] = [];
    const warnings: string[] = [];

    // SEQUENTIAL to avoid memory pressure
    if (source === "twilio" || source === "unified") {
      try {
        const w = await streamTwilioCalls(phone || "", startDate, endDate, summary, recentCalls, deadline);
        warnings.push(...w);
      } catch (e) {
        console.error("Twilio error:", e);
        warnings.push(`Twilio: ${e.message}`);
      }
    }

    if (source === "vapi" || source === "unified") {
      try {
        const w = await streamVapiCalls(phone || "", startDate, endDate, summary, recentCalls, deadline);
        warnings.push(...w);
      } catch (e) {
        console.error("Vapi error:", e);
        warnings.push(`Vapi: ${e.message}`);
      }
    }

    // Sort display calls
    recentCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (summary.totalCalls > MAX_DISPLAY) {
      warnings.push(`Exibindo ${recentCalls.length} de ${summary.totalCalls} chamadas. Métricas refletem o total completo.`);
    }

    console.log("=== FINAL ===");
    console.log(`Pages: ${summary.pagesProcessed} | Twilio: ${summary.twilioCount} ($${summary.twilioCost.toFixed(4)}) | Vapi: ${summary.vapiCount} ($${summary.vapiCost.toFixed(4)})`);
    console.log(`TOTAL: ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)}, ${summary.totalDuration}s | Partial: ${summary.isPartial}`);

    return new Response(JSON.stringify({ calls: recentCalls, warnings, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-call-costs error:", error);
    return new Response(JSON.stringify({ error: error.message, calls: [], warnings: [error.message] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

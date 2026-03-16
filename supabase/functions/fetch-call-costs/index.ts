import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  } catch (e) {
    warnings.push(`Twilio: ${e.message}`);
    console.error("Twilio Usage error:", e);
  }

  return warnings;
}

async function fetchVapiAggregated(
  phone: string,
  startDate: string,
  endDate: string,
  summary: Summary,
  dailyCosts: Record<string, { twilio: number; vapi: number }>,
  deadline: number,
): Promise<string[]> {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) return ["VAPI_API_KEY não configurada"];
  const warnings: string[] = [];

  const minAllowed = new Date();
  minAllowed.setDate(minAllowed.getDate() - 14);
  minAllowed.setHours(0, 0, 0, 0);

  let effStart = new Date(startDate);
  if (effStart < minAllowed) {
    effStart = minAllowed;
    warnings.push(`Vapi: dados limitados aos últimos 14 dias (a partir de ${effStart.toISOString().split("T")[0]}).`);
  }

  const endObj = new Date(`${endDate}T23:59:59`);
  if (effStart > endObj) {
    warnings.push("Vapi: período fora da janela de retenção.");
    return warnings;
  }

  const startIso = effStart.toISOString();
  const endIso = endObj.toISOString();
  const phoneDigits = normalizeDigits(phone);

  let phoneIds: string[] = [];
  if (phoneDigits) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://api.vapi.ai/phone-number", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const phones = await res.json();
        const list = Array.isArray(phones) ? phones : phones.results || [];
        for (const p of list) {
          const digits = normalizeDigits(p.number || p.twilioPhoneNumber || "");
          if (digits.includes(phoneDigits) || phoneDigits.includes(digits)) phoneIds.push(p.id);
        }
      }
    } catch {
      // no-op
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

      const params = new URLSearchParams();
      params.set("createdAtGe", startIso);
      params.set("createdAtLe", endIso);
      params.set("limit", "100");
      if (pid) params.set("phoneNumberId", pid);
      if (cursor) params.set("createdAtLt", cursor);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const text = await res.text();
          warnings.push(`Vapi [${res.status}]: ${text.substring(0, 120)}`);
          break;
        }

        const rawData = await res.json();
        const rawCalls = Array.isArray(rawData) ? rawData : rawData.results || rawData.data || [];

        for (const call of rawCalls) {
          const costVal = call.cost ?? call.costBreakdown?.total ?? 0;
          const cost = typeof costVal === "number" ? costVal : parseFloat(costVal || "0");
          const duration = call.endedAt && call.startedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
            : call.duration || 0;

          const endedReason = call.endedReason || "";
          const isFailed = endedReason.includes("error") || endedReason.includes("failed");

          summary.totalCalls++;
          summary.totalCost += cost;
          summary.totalDuration += duration;
          summary.vapiCount++;
          summary.vapiCost += cost;
          if (isFailed) summary.errorCount++;

          const dateStr = (call.startedAt || call.createdAt || "").substring(0, 10);
          if (dateStr) {
            if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { twilio: 0, vapi: 0 };
            dailyCosts[dateStr].vapi += cost;
          }
        }

        console.log(`Vapi p${pageNum}: ${rawCalls.length} calls, total=${summary.vapiCount}`);

        if (rawCalls.length < 100) break;
        const lastDate = rawCalls[rawCalls.length - 1]?.createdAt;
        if (!lastDate || lastDate === cursor) break;
        cursor = lastDate;
      } catch (e) {
        warnings.push(`Vapi p${pageNum}: ${e.message}`);
        break;
      }
    }

    if (pageNum >= VAPI_MAX_PAGES) {
      summary.isPartial = true;
      warnings.push(`Vapi: resultado parcial (${summary.vapiCount} chamadas em ${VAPI_MAX_PAGES} páginas).`);
    }
  }

  console.log(`Vapi DONE: ${summary.vapiCount} calls, $${summary.vapiCost.toFixed(4)}`);
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

    const deadline = Date.now() + 40_000;
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
      warnings.push(...await fetchVapiAggregated(phone || "", startDate, endDate, summary, dailyCosts, deadline));
    }

    console.log("=== FINAL ===");
    console.log(`Twilio: ${summary.twilioCount} ($${summary.twilioCost.toFixed(4)}) | Vapi: ${summary.vapiCount} ($${summary.vapiCost.toFixed(4)})`);
    console.log(`TOTAL: ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)} | Partial: ${summary.isPartial}`);

    return jsonResponse({ warnings, summary, dailyCosts });
  } catch (error) {
    console.error("fetch-call-costs error:", error);
    return jsonResponse({
      error: error.message || "Erro inesperado",
      warnings: [error.message || "Erro inesperado"],
      summary: null,
      dailyCosts: {},
    });
  }
});

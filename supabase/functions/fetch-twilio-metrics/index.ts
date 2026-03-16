import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TwilioCallRecord {
  sid: string;
  from: string;
  to: string;
  duration: number;
  price: number;
  status: string;
  date: string;
  direction: string;
}

interface TwilioSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  completedCount: number;
  busyCount: number;
  failedCount: number;
  noAnswerCount: number;
  canceledCount: number;
  isPartial: boolean;
  usageCost: number | null;
  usageMinutes: number | null;
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

const MAX_DISPLAY = 100;
const SUPPORTED_STATUSES = ["completed", "busy", "failed", "no-answer", "canceled"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
    if (!sid || !token) throw new Error("Twilio credentials not configured");

    let startDate: string | null = null;
    let endDate: string | null = null;
    let statusFilter: string[] | string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      startDate = url.searchParams.get("startDate");
      endDate = url.searchParams.get("endDate");
      const statusParams = url.searchParams.getAll("statusFilter");
      statusFilter = statusParams.length > 1 ? statusParams : statusParams[0] ?? null;
    } else {
      const body = await req.json().catch(() => ({}));
      startDate = body?.startDate ?? null;
      endDate = body?.endDate ?? null;
      statusFilter = body?.statusFilter ?? null;
    }

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = encodeBasicAuth(sid, token);
    const statusFilters: string[] = statusFilter ? (Array.isArray(statusFilter) ? statusFilter : [statusFilter]) : [];

    const summary: TwilioSummary = {
      totalCalls: 0, totalCost: 0, totalDuration: 0,
      completedCount: 0, busyCount: 0, failedCount: 0,
      noAnswerCount: 0, canceledCount: 0,
      isPartial: false, usageCost: null, usageMinutes: null,
    };
    const recentCalls: TwilioCallRecord[] = [];
    const dailyCosts: Record<string, { cost: number; count: number; duration: number }> = {};
    const warnings: string[] = [];

    // ─── STRATEGY: Use Usage Records/Daily for aggregated KPIs + daily chart (1 fast API call) ───
    // Then fetch only 1-2 pages of individual calls for the display table.
    // This avoids iterating 22k+ calls which causes timeouts.

    // 1. Fetch Usage Records/Daily for aggregated data
    try {
      const usageParams = new URLSearchParams();
      usageParams.set("StartDate", startDate);
      usageParams.set("EndDate", endDate);
      usageParams.set("Category", "calls");
      const usageUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records/Daily.json?${usageParams.toString()}`;
      const usageRes = await fetch(usageUrl, { headers: { Authorization: `Basic ${auth}` } });
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        const records = usageData.usage_records || [];
        let totalPrice = 0;
        let totalMinutes = 0;
        let totalCount = 0;

        for (const rec of records) {
          const cost = Math.abs(parseFloat(rec.price || "0"));
          const minutes = parseFloat(rec.usage || "0");
          const count = parseInt(rec.count || "0", 10);
          totalPrice += cost;
          totalMinutes += minutes;
          totalCount += count;

          const dateStr = rec.start_date || "";
          if (dateStr) {
            if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { cost: 0, count: 0, duration: 0 };
            dailyCosts[dateStr].cost += cost;
            dailyCosts[dateStr].count += count;
            dailyCosts[dateStr].duration += Math.round(minutes * 60);
          }
        }

        summary.usageCost = totalPrice;
        summary.usageMinutes = totalMinutes;
        summary.totalCost = totalPrice;
        summary.totalDuration = Math.round(totalMinutes * 60);
        summary.totalCalls = totalCount;

        console.log(`Twilio Usage Records: ${records.length} days, ${totalCount} calls, $${totalPrice.toFixed(4)}, ${totalMinutes} min`);
      } else {
        const text = await usageRes.text();
        warnings.push(`Twilio Usage API [${usageRes.status}]: ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      warnings.push(`Twilio Usage: ${e?.message || "erro"}`);
    }

    // 2. Fetch individual calls for recent display table + status cards.
    // KPIs and chart are always complete via Usage Records.
    const hasSpecificStatusFilter = statusFilters.length > 0 && statusFilters.length < SUPPORTED_STATUSES.length;
    const needsFilteredScan = hasSpecificStatusFilter;
    const maxCallPages = needsFilteredScan ? 40 : 1;

    const callParams = new URLSearchParams();
    callParams.set("StartTime>=", `${startDate}T00:00:00Z`);
    callParams.set("StartTime<=", `${endDate}T23:59:59Z`);
    callParams.set("PageSize", needsFilteredScan ? "500" : "100");
    let nextPageUrl: string | null = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?${callParams.toString()}`;
    let pageNum = 0;

    // If filtering by status, we override summary with filtered totals
    let filteredSummary: TwilioSummary | null = null;
    const filteredDailyCosts: Record<string, { cost: number; count: number; duration: number }> = {};

    if (needsFilteredScan) {
      filteredSummary = {
        totalCalls: 0, totalCost: 0, totalDuration: 0,
        completedCount: 0, busyCount: 0, failedCount: 0,
        noAnswerCount: 0, canceledCount: 0,
        isPartial: false, usageCost: summary.usageCost, usageMinutes: summary.usageMinutes,
      };
    }

    const deadline = Date.now() + 50_000;

    while (nextPageUrl && pageNum < maxCallPages) {
      if (Date.now() > deadline) {
        if (filteredSummary) {
          filteredSummary.isPartial = true;
          warnings.push(`Resultado parcial para filtro de status. Reduza o período.`);
        }
        break;
      }

      pageNum++;
      try {
        const res: Response = await fetch(nextPageUrl!, { headers: { Authorization: `Basic ${auth}` } });
        if (!res.ok) {
          const text = await res.text();
          warnings.push(`Twilio Calls API [${res.status}]: ${text.substring(0, 200)}`);
          break;
        }

        const data: any = await res.json();
        const pageCalls = data.calls || [];

        for (const call of pageCalls) {
          const from = call.from || "";
          const to = call.to || "";
          if (phoneDigits && !normalizeDigits(from).includes(phoneDigits) && !normalizeDigits(to).includes(phoneDigits)) continue;

          const status = call.status || "unknown";
          if (hasSpecificStatusFilter && !statusFilters.includes(status)) continue;

          const cost = Math.abs(parseFloat(call.price || "0"));
          const duration = parseInt(call.duration || "0", 10);

          if (filteredSummary) {
            filteredSummary.totalCalls++;
            filteredSummary.totalCost += cost;
            filteredSummary.totalDuration += duration;

            switch (status) {
              case "completed": filteredSummary.completedCount++; break;
              case "busy": filteredSummary.busyCount++; break;
              case "failed": filteredSummary.failedCount++; break;
              case "no-answer": filteredSummary.noAnswerCount++; break;
              case "canceled": filteredSummary.canceledCount++; break;
            }

            const dateStr = (call.start_time || call.date_created || "").substring(0, 10);
            if (dateStr) {
              if (!filteredDailyCosts[dateStr]) filteredDailyCosts[dateStr] = { cost: 0, count: 0, duration: 0 };
              filteredDailyCosts[dateStr].cost += cost;
              filteredDailyCosts[dateStr].count++;
              filteredDailyCosts[dateStr].duration += duration;
            }
          } else {
            // No filter — just count statuses from individual calls
            switch (status) {
              case "completed": summary.completedCount++; break;
              case "busy": summary.busyCount++; break;
              case "failed": summary.failedCount++; break;
              case "no-answer": summary.noAnswerCount++; break;
              case "canceled": summary.canceledCount++; break;
            }
          }

          if (recentCalls.length < MAX_DISPLAY) {
            recentCalls.push({
              sid: call.sid,
              from,
              to,
              duration,
              price: cost,
              status,
              date: call.start_time || call.date_created,
              direction: call.direction || "unknown",
            });
          }
        }

        console.log(`Twilio p${pageNum}: ${pageCalls.length} calls, display=${recentCalls.length}`);
        nextPageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
      } catch (e: any) {
        warnings.push(`Twilio Calls p${pageNum}: ${e?.message || "erro"}`);
        break;
      }
    }

    // Use filtered summary only when explicit status filter is applied
    const finalSummary = filteredSummary || summary;
    const finalDailyCosts = needsFilteredScan ? filteredDailyCosts : dailyCosts;

    recentCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyChart = Object.entries(finalDailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, cost: +d.cost.toFixed(4), count: d.count, duration: d.duration }));

    if (finalSummary.totalCalls > MAX_DISPLAY) {
      warnings.push(`Exibindo ${recentCalls.length} de ${finalSummary.totalCalls} chamadas na tabela.`);
    }

    warnings.push("Os custos de chamadas recentes na Twilio podem levar alguns minutos para serem processados.");

    console.log(`=== TWILIO METRICS DONE: ${finalSummary.totalCalls} calls, $${finalSummary.totalCost.toFixed(4)} ===`);

    return new Response(JSON.stringify({ calls: recentCalls, summary: finalSummary, dailyChart, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("fetch-twilio-metrics error:", error);
    const message = error?.message || "Erro inesperado";
    return new Response(JSON.stringify({ error: message, calls: [], warnings: [message] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

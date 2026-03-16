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


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
    if (!sid || !token) throw new Error("Twilio credentials not configured");

    const { startDate, endDate, phone, statusFilter } = await req.json();
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = encodeBasicAuth(sid, token);
    const deadline = Date.now() + 50_000;
    const phoneDigits = normalizeDigits(phone || "");
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

    // 1. Fetch Usage Records for summary KPIs
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
        for (const rec of records) {
          totalPrice += Math.abs(parseFloat(rec.price || "0"));
          totalMinutes += parseFloat(rec.usage || "0");
        }
        summary.usageCost = totalPrice;
        summary.usageMinutes = totalMinutes;
        console.log(`Twilio Usage Records: $${totalPrice.toFixed(4)}, ${totalMinutes} min`);
      } else {
        const text = await usageRes.text();
        warnings.push(`Twilio Usage API [${usageRes.status}]: ${text.substring(0, 200)}`);
      }
    } catch (e) {
      warnings.push(`Twilio Usage: ${e.message}`);
    }

    // 2. Fetch Calls for detailed listing
    const callParams = new URLSearchParams();
    callParams.set("StartTime>=", `${startDate}T00:00:00Z`);
    callParams.set("StartTime<=", `${endDate}T23:59:59Z`);
    callParams.set("PageSize", "1000");
    let nextPageUrl: string | null = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?${callParams.toString()}`;
    let pageNum = 0;

    while (nextPageUrl) {
      if (Date.now() > deadline || pageNum >= MAX_PAGES) {
        summary.isPartial = true;
        if (pageNum >= MAX_PAGES) {
          warnings.push(`Exibindo dados das ${pageNum} primeiras páginas (${summary.totalCalls} chamadas). Use filtros ou reduza o período para resultados completos.`);
        } else {
          warnings.push(`Resultado parcial (${summary.totalCalls} chamadas). Reduza o período.`);
        }
        break;
      }

      pageNum++;
      const res = await fetch(nextPageUrl, { headers: { Authorization: `Basic ${auth}` } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Twilio Calls API [${res.status}]: ${text}`);
      }

      const data = await res.json();
      const pageCalls = data.calls || [];

      for (const call of pageCalls) {
        const from = call.from || "";
        const to = call.to || "";
        if (phoneDigits && !normalizeDigits(from).includes(phoneDigits) && !normalizeDigits(to).includes(phoneDigits)) continue;

        const status = call.status || "unknown";
        if (statusFilters.length > 0 && !statusFilters.includes(status)) continue;

        const cost = Math.abs(parseFloat(call.price || "0"));
        const duration = parseInt(call.duration || "0", 10);

        summary.totalCalls++;
        summary.totalCost += cost;
        summary.totalDuration += duration;

        switch (status) {
          case "completed": summary.completedCount++; break;
          case "busy": summary.busyCount++; break;
          case "failed": summary.failedCount++; break;
          case "no-answer": summary.noAnswerCount++; break;
          case "canceled": summary.canceledCount++; break;
        }

        // Daily aggregation
        const dateStr = (call.start_time || call.date_created || "").substring(0, 10);
        if (dateStr) {
          if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { cost: 0, count: 0, duration: 0 };
          dailyCosts[dateStr].cost += cost;
          dailyCosts[dateStr].count++;
          dailyCosts[dateStr].duration += duration;
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

      console.log(`Twilio p${pageNum}: ${pageCalls.length} calls, running total=${summary.totalCalls}`);
      nextPageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
    }

    recentCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyChart = Object.entries(dailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, cost: +d.cost.toFixed(4), count: d.count, duration: d.duration }));

    if (summary.totalCalls > MAX_DISPLAY) {
      warnings.push(`Exibindo ${recentCalls.length} de ${summary.totalCalls} chamadas na tabela.`);
    }

    // Delay warning
    warnings.push("Os custos de chamadas recentes na Twilio podem levar alguns minutos para serem processados.");

    console.log(`=== TWILIO METRICS DONE: ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)} ===`);

    return new Response(JSON.stringify({ calls: recentCalls, summary, dailyChart, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-twilio-metrics error:", error);
    return new Response(JSON.stringify({ error: error.message, calls: [], warnings: [error.message] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

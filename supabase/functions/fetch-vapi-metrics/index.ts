import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VapiCallRecord {
  id: string;
  customer: string;
  agentPhone: string;
  duration: number;
  cost: number;
  status: string;
  date: string;
  costBreakdown: {
    stt: number;
    llm: number;
    tts: number;
    transport: number;
    vapi: number;
  };
}

interface VapiSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  endedCount: number;
  costBreakdown: {
    stt: number;
    llm: number;
    tts: number;
    transport: number;
    vapi: number;
  };
  isPartial: boolean;
}

const MAX_DISPLAY = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("VAPI_API_KEY");
    if (!apiKey) throw new Error("VAPI_API_KEY not configured");

    const body = await req.json();

    // Action: list resources (assistants + phone numbers) with names
    if (body.action === "list-resources") {
      const [assistantsRes, phonesRes] = await Promise.all([
        fetch("https://api.vapi.ai/assistant", { headers: { Authorization: `Bearer ${apiKey}` } }),
        fetch("https://api.vapi.ai/phone-number", { headers: { Authorization: `Bearer ${apiKey}` } }),
      ]);

      const assistants: { id: string; name: string }[] = [];
      const phoneNumbers: { id: string; number: string; name: string }[] = [];

      if (assistantsRes.ok) {
        const raw = await assistantsRes.json();
        const list = Array.isArray(raw) ? raw : raw.results || raw.data || [];
        for (const a of list) {
          assistants.push({ id: a.id, name: a.name || a.id.substring(0, 12) });
        }
      } else {
        await assistantsRes.text(); // consume body
      }

      if (phonesRes.ok) {
        const raw = await phonesRes.json();
        const list = Array.isArray(raw) ? raw : raw.results || raw.data || [];
        for (const p of list) {
          phoneNumbers.push({
            id: p.id,
            number: p.number || p.twilioPhoneNumber || p.id,
            name: p.name || p.friendlyName || "",
          });
        }
      } else {
        await phonesRes.text(); // consume body
      }

      return new Response(JSON.stringify({ assistants, phoneNumbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: fetch metrics
    const { startDate, endDate, assistantId, phoneNumberId, assistantIds, phoneNumberIds } = body;
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deadline = Date.now() + 50_000;
    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate + "T23:59:59").toISOString();

    // Support both single and array params
    const hasAssistantIds = Array.isArray(body.assistantIds);
    const hasPhoneNumberIds = Array.isArray(body.phoneNumberIds);

    const effectiveAssistantIds: string[] = hasAssistantIds
      ? body.assistantIds
      : (assistantId && assistantId !== "all" ? [assistantId] : []);

    const effectivePhoneIds: string[] = hasPhoneNumberIds
      ? body.phoneNumberIds
      : (phoneNumberId && phoneNumberId !== "all" ? [phoneNumberId] : []);

    const warnings: string[] = [];

    const summary: VapiSummary = {
      totalCalls: 0, totalCost: 0, totalDuration: 0, endedCount: 0,
      costBreakdown: { stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 },
      isPartial: false,
    };
    const recentCalls: VapiCallRecord[] = [];
    const dailyCosts: Record<string, { cost: number; count: number }> = {};

    // Build list of filter combos to query
    // If multiple phoneIds, query each separately (Vapi API only supports single phoneNumberId)
    const phoneQueries = effectivePhoneIds.length > 0 ? effectivePhoneIds : [undefined];
    const assistantQueries = effectiveAssistantIds.length > 0 ? effectiveAssistantIds : [undefined];

    for (const aId of assistantQueries) {
      for (const pId of phoneQueries) {
        let cursor: string | null = null;
        let pageNum = 0;

        while (true) {
          if (Date.now() > deadline) {
            summary.isPartial = true;
            warnings.push(`Resultado parcial (${summary.totalCalls} chamadas). Reduza o período.`);
            break;
          }

          pageNum++;
          const params = new URLSearchParams();
          params.set("createdAtGe", startIso);
          params.set("createdAtLe", endIso);
          params.set("limit", "1000");
          if (aId) params.set("assistantId", aId);
          if (pId) params.set("phoneNumberId", pId);
          if (cursor) params.set("createdAtLt", cursor);

          const res = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          if (!res.ok) {
            const text = await res.text();
            // Check for subscription/retention error
            if (text.toLowerCase().includes("subscription") || text.toLowerCase().includes("plan limit")) {
              warnings.push("Dados limitados pelo plano Vapi atual.");
              summary.isPartial = true;
              break;
            }
            throw new Error(`Vapi API [${res.status}]: ${text}`);
          }

          const rawData = await res.json();
          const rawCalls = Array.isArray(rawData) ? rawData : rawData.results || rawData.data || [];

          for (const call of rawCalls) {
            const costVal = call.cost ?? call.costBreakdown?.total ?? 0;
            const cost = typeof costVal === "number" ? costVal : parseFloat(costVal || "0");
            const duration = call.endedAt && call.startedAt
              ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
              : call.duration || 0;

            const status = call.status || "unknown";
            const endedReason = call.endedReason || "";
            const isEnded = status === "ended" && !endedReason.includes("error") && !endedReason.includes("failed");

            const cb = call.costBreakdown || {};
            const stt = parseFloat(cb.stt || "0");
            const llm = parseFloat(cb.llm || "0");
            const tts = parseFloat(cb.tts || "0");
            const transport = parseFloat(cb.transport || "0");
            const vapiCost = parseFloat(cb.vapi || "0");

            summary.totalCalls++;
            summary.totalCost += cost;
            summary.totalDuration += duration;
            if (isEnded) summary.endedCount++;
            summary.costBreakdown.stt += stt;
            summary.costBreakdown.llm += llm;
            summary.costBreakdown.tts += tts;
            summary.costBreakdown.transport += transport;
            summary.costBreakdown.vapi += vapiCost;

            const dateStr = (call.startedAt || call.createdAt || "").substring(0, 10);
            if (dateStr) {
              if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { cost: 0, count: 0 };
              dailyCosts[dateStr].cost += cost;
              dailyCosts[dateStr].count++;
            }

            if (recentCalls.length < MAX_DISPLAY) {
              recentCalls.push({
                id: call.id,
                customer: call.customer?.number || call.customer?.name || "—",
                agentPhone: call.phoneNumber?.number || call.phoneNumber?.twilioPhoneNumber || "",
                duration,
                cost,
                status: isEnded ? "ended" : (endedReason || status),
                date: call.startedAt || call.createdAt,
                costBreakdown: { stt, llm, tts, transport, vapi: vapiCost },
              });
            }
          }

          console.log(`Vapi metrics p${pageNum}: ${rawCalls.length} calls, total=${summary.totalCalls}`);

          if (rawCalls.length < 1000) break;
          const lastDate = rawCalls[rawCalls.length - 1]?.createdAt;
          if (!lastDate || lastDate === cursor) break;
          cursor = lastDate;
        }

        if (summary.isPartial) break;
      }
      if (summary.isPartial) break;
    }

    recentCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyChart = Object.entries(dailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, cost: +data.cost.toFixed(4), count: data.count }));

    if (summary.totalCalls > MAX_DISPLAY) {
      warnings.push(`Exibindo ${recentCalls.length} de ${summary.totalCalls} chamadas na tabela.`);
    }

    console.log(`=== VAPI METRICS DONE: ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)} ===`);

    return new Response(JSON.stringify({ calls: recentCalls, summary, dailyChart, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-vapi-metrics error:", error);
    return new Response(JSON.stringify({ error: error.message, calls: [], warnings: [error.message] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

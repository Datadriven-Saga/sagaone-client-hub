import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  costBreakdown: { stt: number; llm: number; tts: number; transport: number; vapi: number };
}

interface VapiSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  endedCount: number;
  costBreakdown: { stt: number; llm: number; tts: number; transport: number; vapi: number };
  isPartial: boolean;
}

const MAX_DISPLAY = 100;
const VAPI_RETENTION_DAYS = 14;
const CACHE_PAGE_SIZE = 1000;

function parseCall(call: any): {
  callId: string; assistantId: string; phoneNumberId: string;
  customerNumber: string; agentPhone: string; duration: number;
  cost: number; status: string; startedAt: string;
  stt: number; llm: number; tts: number; transport: number; vapiCost: number;
  isEnded: boolean;
} {
  const costVal = call.cost ?? call.costBreakdown?.total ?? 0;
  const cost = typeof costVal === "number" ? costVal : parseFloat(costVal || "0");
  const duration = call.endedAt && call.startedAt
    ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    : call.duration || 0;
  const statusVal = call.status || "unknown";
  const endedReason = call.endedReason || "";
  const isEnded = statusVal === "ended" && !endedReason.includes("error") && !endedReason.includes("failed");
  const cb = call.costBreakdown || {};

  return {
    callId: call.id,
    assistantId: call.assistantId || call.assistant?.id || "",
    phoneNumberId: call.phoneNumberId || call.phoneNumber?.id || "",
    customerNumber: call.customer?.number || call.customer?.name || "—",
    agentPhone: call.phoneNumber?.number || call.phoneNumber?.twilioPhoneNumber || "",
    duration,
    cost,
    status: isEnded ? "ended" : (endedReason || statusVal),
    startedAt: call.startedAt || call.createdAt || "",
    stt: parseFloat(cb.stt || "0"),
    llm: parseFloat(cb.llm || "0"),
    tts: parseFloat(cb.tts || "0"),
    transport: parseFloat(cb.transport || "0"),
    vapiCost: parseFloat(cb.vapi || "0"),
    isEnded,
  };
}

interface DailyBucket {
  cost: number; count: number; duration: number;
  stt: number; llm: number; tts: number; transport: number; vapi: number;
}

function buildResponse(
  calls: VapiCallRecord[], summary: VapiSummary,
  dailyCosts: Record<string, DailyBucket>,
  warnings: string[], source: string,
) {
  calls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const dailyChart = Object.entries(dailyCosts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      cost: +d.cost.toFixed(4),
      count: d.count,
      duration: d.duration,
      stt: +d.stt.toFixed(4),
      llm: +d.llm.toFixed(4),
      tts: +d.tts.toFixed(4),
      transport: +d.transport.toFixed(4),
      vapi: +d.vapi.toFixed(4),
    }));

  if (summary.totalCalls > MAX_DISPLAY) {
    warnings.push(`Exibindo ${calls.length} de ${summary.totalCalls} chamadas na tabela.`);
  }
  console.log(`=== VAPI METRICS DONE (${source}): ${summary.totalCalls} calls, $${summary.totalCost.toFixed(4)} ===`);

  return new Response(JSON.stringify({ calls, summary, dailyChart, warnings, source }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addToSummary(
  summary: VapiSummary, dailyCosts: Record<string, DailyBucket>,
  recentCalls: VapiCallRecord[],
  p: ReturnType<typeof parseCall>,
) {
  summary.totalCalls++;
  summary.totalCost += p.cost;
  summary.totalDuration += p.duration;
  if (p.isEnded) summary.endedCount++;
  summary.costBreakdown.stt += p.stt;
  summary.costBreakdown.llm += p.llm;
  summary.costBreakdown.tts += p.tts;
  summary.costBreakdown.transport += p.transport;
  summary.costBreakdown.vapi += p.vapiCost;

  const dateStr = (p.startedAt || "").substring(0, 10);
  if (dateStr) {
    if (!dailyCosts[dateStr]) dailyCosts[dateStr] = { cost: 0, count: 0, duration: 0, stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 };
    const b = dailyCosts[dateStr];
    b.cost += p.cost;
    b.count++;
    b.duration += p.duration;
    b.stt += p.stt;
    b.llm += p.llm;
    b.tts += p.tts;
    b.transport += p.transport;
    b.vapi += p.vapiCost;
  }

  if (recentCalls.length < MAX_DISPLAY) {
    recentCalls.push({
      id: p.callId,
      customer: p.customerNumber,
      agentPhone: p.agentPhone,
      duration: p.duration,
      cost: p.cost,
      status: p.status,
      date: p.startedAt,
      costBreakdown: { stt: p.stt, llm: p.llm, tts: p.tts, transport: p.transport, vapi: p.vapiCost },
    });
  }
}

// ── Sync only the recent delta from Vapi API to cache ──
async function syncRecentToCache(
  apiKey: string,
  supabase: any,
  syncStartIso: string,
  endIso: string,
  seenCallIds: Set<string>,
): Promise<{ newCalls: number; warnings: string[] }> {
  const warnings: string[] = [];
  let newCalls = 0;
  let cursor: string | null = null;
  let pageNum = 0;
  const deadline = Date.now() + 25_000; // Max 25s for sync

  while (true) {
    if (Date.now() > deadline) {
      warnings.push("Sincronização parcial com Vapi API. Dados do cache podem estar levemente desatualizados.");
      break;
    }

    pageNum++;
    const params = new URLSearchParams();
    params.set("createdAtGe", syncStartIso);
    params.set("createdAtLe", endIso);
    params.set("limit", "100");
    if (cursor) params.set("createdAtLt", cursor);

    try {
      const res = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        const text = await res.text();
        if (text.toLowerCase().includes("subscription") || text.toLowerCase().includes("plan limit")) {
          warnings.push("Dados limitados pelo plano Vapi atual.");
        } else {
          warnings.push(`Vapi API [${res.status}]: ${text.substring(0, 120)}`);
        }
        break;
      }

      const rawData = await res.json();
      const rawCalls: any[] = Array.isArray(rawData) ? rawData : rawData.results || rawData.data || [];
      const batch: any[] = [];
      let lastCreatedAt: string | null = null;

      for (const call of rawCalls) {
        lastCreatedAt = call.createdAt || lastCreatedAt;
        if (seenCallIds.has(call.id)) continue;

        const p = parseCall(call);
        const metaOnly = call.metadata || call.assistantOverrides?.metadata;

        batch.push({
          call_id: p.callId,
          assistant_id: p.assistantId || null,
          phone_number_id: p.phoneNumberId || null,
          customer_number: p.customerNumber,
          agent_phone: p.agentPhone,
          duration: p.duration,
          cost: p.cost,
          status: p.status,
          started_at: p.startedAt || null,
          cost_stt: p.stt,
          cost_llm: p.llm,
          cost_tts: p.tts,
          cost_transport: p.transport,
          cost_vapi: p.vapiCost,
          raw_data: metaOnly ? { metadata: metaOnly } : null,
          synced_at: new Date().toISOString(),
        });

        seenCallIds.add(call.id);
        newCalls++;
      }

      if (batch.length > 0) {
        const { error } = await supabase.from("vapi_calls_cache").upsert(batch, {
          onConflict: "call_id",
          ignoreDuplicates: false,
        });
        if (error) warnings.push(`Cache upsert: ${error.message}`);
      }

      console.log(`Vapi sync p${pageNum}: ${rawCalls.length} calls, ${batch.length} new`);

      if (rawCalls.length < 100 || !lastCreatedAt || lastCreatedAt === cursor) break;
      cursor = lastCreatedAt;
    } catch (e: any) {
      warnings.push(`Vapi sync p${pageNum}: ${e?.message || "erro"}`);
      break;
    }
  }

  return { newCalls, warnings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("VAPI_API_KEY");
    if (!apiKey) throw new Error("VAPI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // ── Action: list resources ──
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
        for (const a of list) assistants.push({ id: a.id, name: a.name || a.id.substring(0, 12) });
      } else { await assistantsRes.text(); }

      if (phonesRes.ok) {
        const raw = await phonesRes.json();
        const list = Array.isArray(raw) ? raw : raw.results || raw.data || [];
        for (const p of list) phoneNumbers.push({ id: p.id, number: p.number || p.twilioPhoneNumber || p.id, name: p.name || p.friendlyName || "" });
      } else { await phonesRes.text(); }

      return new Response(JSON.stringify({ assistants, phoneNumbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: sync-and-query (default) ──
    const { startDate, endDate, assistantId, phoneNumberId, metadataKey, metadataValue } = body;
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasAssistantIds = Array.isArray(body.assistantIds);
    const hasPhoneNumberIds = Array.isArray(body.phoneNumberIds);
    const effectiveAssistantIds: string[] = hasAssistantIds ? body.assistantIds : (assistantId && assistantId !== "all" ? [assistantId] : []);
    const effectivePhoneIds: string[] = hasPhoneNumberIds ? body.phoneNumberIds : (phoneNumberId && phoneNumberId !== "all" ? [phoneNumberId] : []);
    const filterByMetadata = !!metadataKey;

    // Empty explicit filter = no results
    if ((hasAssistantIds && effectiveAssistantIds.length === 0) || (hasPhoneNumberIds && effectivePhoneIds.length === 0)) {
      const emptySummary: VapiSummary = { totalCalls: 0, totalCost: 0, totalDuration: 0, endedCount: 0, costBreakdown: { stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 }, isPartial: false };
      return new Response(JSON.stringify({ calls: [], summary: emptySummary, dailyChart: [], warnings: ["Nenhum item selecionado no filtro."], source: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate + "T23:59:59").toISOString();
    const now = new Date();
    const vapiCutoff = new Date(now.getTime() - VAPI_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const warnings: string[] = [];
    const summary: VapiSummary = { totalCalls: 0, totalCost: 0, totalDuration: 0, endedCount: 0, costBreakdown: { stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 }, isPartial: false };
    const recentCalls: VapiCallRecord[] = [];
    const dailyCosts: Record<string, DailyBucket> = {};
    const seenCallIds = new Set<string>();
    let dataSource = "cache";

    // ── STEP 1: Sync only delta from Vapi API (last 6 hours or since latest cache) ──
    {
      // Find the latest cached call to know where to start syncing
      const { data: latestRow } = await supabase
        .from("vapi_calls_cache")
        .select("started_at")
        .order("started_at", { ascending: false })
        .limit(1);

      const latestCached = latestRow?.[0]?.started_at;

      // Determine sync window: from latest cached - 1h overlap, or from retention cutoff
      let syncStart: Date;
      if (latestCached) {
        syncStart = new Date(latestCached);
        syncStart.setHours(syncStart.getHours() - 1); // 1h overlap for safety
      } else {
        syncStart = vapiCutoff;
      }

      const requestedEnd = new Date(endDate + "T23:59:59");
      if (syncStart < requestedEnd) {
        console.log(`🔄 Syncing Vapi API from ${syncStart.toISOString()} to ${endIso}`);
        const syncResult = await syncRecentToCache(apiKey, supabase, syncStart.toISOString(), endIso, seenCallIds);
        warnings.push(...syncResult.warnings);
        if (syncResult.newCalls > 0) {
          console.log(`✅ ${syncResult.newCalls} novas chamadas sincronizadas ao cache`);
        }
        dataSource = "cache+vapi";
      }
    }

    // Reset seenCallIds for the reading phase
    seenCallIds.clear();

    // ── STEP 2: Read ALL data from cache (fast, paginated, no external API calls) ──
    const assistantIdSet = new Set(effectiveAssistantIds);
    const phoneIdSet = new Set(effectivePhoneIds);
    const filterByAssistant = effectiveAssistantIds.length > 0;
    const filterByPhone = effectivePhoneIds.length > 0;

    let from = 0;

    while (true) {
      let query = supabase
        .from("vapi_calls_cache")
        .select("*")
        .gte("started_at", startIso)
        .lte("started_at", endIso)
        .order("started_at", { ascending: true })
        .range(from, from + CACHE_PAGE_SIZE - 1);

      if (effectiveAssistantIds.length > 0) query = query.in("assistant_id", effectiveAssistantIds);
      if (effectivePhoneIds.length > 0) query = query.in("phone_number_id", effectivePhoneIds);

      const { data: cachedCalls, error: cacheErr } = await query;
      if (cacheErr) {
        console.error("Cache query error:", cacheErr);
        warnings.push(`Erro no cache: ${cacheErr.message}`);
        break;
      }

      if (!cachedCalls || cachedCalls.length === 0) break;

      console.log(`📦 Cache page: ${cachedCalls.length} chamadas (offset ${from})`);

      for (const cc of cachedCalls) {
        if (seenCallIds.has(cc.call_id)) continue;

        // Metadata filter on cached raw_data
        if (filterByMetadata && cc.raw_data) {
          const rawMeta = (cc.raw_data as any)?.metadata || (cc.raw_data as any)?.assistantOverrides?.metadata;
          if (!rawMeta || String(rawMeta[metadataKey] ?? "") !== String(metadataValue ?? "")) continue;
        } else if (filterByMetadata) {
          continue;
        }

        seenCallIds.add(cc.call_id);

        const isEnded = cc.status === "ended";
        const p = {
          callId: cc.call_id, assistantId: cc.assistant_id || "", phoneNumberId: cc.phone_number_id || "",
          customerNumber: cc.customer_number || "—", agentPhone: cc.agent_phone || "",
          duration: cc.duration || 0, cost: Number(cc.cost) || 0, status: cc.status || "unknown",
          startedAt: cc.started_at || "", stt: Number(cc.cost_stt) || 0, llm: Number(cc.cost_llm) || 0,
          tts: Number(cc.cost_tts) || 0, transport: Number(cc.cost_transport) || 0, vapiCost: Number(cc.cost_vapi) || 0,
          isEnded,
        };
        addToSummary(summary, dailyCosts, recentCalls, p);
      }

      if (cachedCalls.length < CACHE_PAGE_SIZE) break;
      from += CACHE_PAGE_SIZE;
    }

    return buildResponse(recentCalls, summary, dailyCosts, warnings, dataSource);
  } catch (error: any) {
    console.error("fetch-vapi-metrics error:", error);
    const message = error?.message || "Erro inesperado";
    return new Response(JSON.stringify({ error: message, calls: [], warnings: [message] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

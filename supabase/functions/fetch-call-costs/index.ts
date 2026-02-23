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
}

async function fetchTwilioCalls(phone: string, startDate: string, endDate: string): Promise<CallRecord[]> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) throw new Error("Twilio credentials not configured");

  const params = new URLSearchParams();
  params.set("StartTime>", startDate);
  params.set("EndTime<", endDate);
  params.set("PageSize", "1000");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?${params.toString()}`;
  const auth = btoa(`${accountSid}:${authToken}`);

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const calls: CallRecord[] = [];

  for (const call of data.calls || []) {
    const from = call.from || "";
    const to = call.to || "";
    const matchesPhone = !phone || from.includes(phone) || to.includes(phone);
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

  return calls;
}

async function fetchVapiCalls(phone: string, startDate: string, endDate: string): Promise<CallRecord[]> {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) throw new Error("VAPI_API_KEY not configured");

  const params = new URLSearchParams();
  params.set("createdAtGe", new Date(startDate).toISOString());
  params.set("createdAtLe", new Date(endDate).toISOString());
  params.set("limit", "1000");

  const url = `https://api.vapi.ai/call?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const rawCalls = Array.isArray(data) ? data : data.results || data.data || [];
  const calls: CallRecord[] = [];

  for (const call of rawCalls) {
    const phoneNumber = call.phoneNumber?.number || call.phoneNumberId || "";
    const customerNumber = call.customer?.number || "";
    const matchesPhone = !phone || phoneNumber.includes(phone) || customerNumber.includes(phone);
    if (!matchesPhone) continue;

    const costVal = call.cost || call.costBreakdown?.total || 0;
    const durationSec = call.endedAt && call.startedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : call.duration || 0;

    calls.push({
      id: call.id,
      phoneFrom: phoneNumber,
      phoneTo: customerNumber,
      duration: durationSec,
      cost: typeof costVal === "number" ? costVal : parseFloat(costVal || "0"),
      source: "vapi",
      date: call.createdAt || call.startedAt,
    });
  }

  return calls;
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

    if (source === "twilio" || source === "unified") {
      try {
        const twilioCalls = await fetchTwilioCalls(phone || "", startDate, endDate);
        results = results.concat(twilioCalls);
      } catch (e) {
        console.error("Twilio fetch error:", e);
        if (source === "twilio") throw e;
      }
    }

    if (source === "vapi" || source === "unified") {
      try {
        const vapiCalls = await fetchVapiCalls(phone || "", startDate, endDate);
        results = results.concat(vapiCalls);
      } catch (e) {
        console.error("Vapi fetch error:", e);
        if (source === "vapi") throw e;
      }
    }

    // Sort by date desc
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(JSON.stringify({ calls: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-call-costs error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

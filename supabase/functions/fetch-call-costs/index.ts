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
  const params = new URLSearchParams();
  params.set("StartTime>", startDate);
  params.set("EndTime<", endDate);
  params.set("PageSize", "1000");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?${params.toString()}`;
  const auth = btoa(`${sid}:${token}`);

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const phoneDigits = normalizeDigits(phone);
  const calls: CallRecord[] = [];

  for (const call of data.calls || []) {
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

  return calls;
}

async function fetchTwilioCalls(phone: string, startDate: string, endDate: string): Promise<CallRecord[]> {
  // Try primary credentials
  const sid1 = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token1 = Deno.env.get("TWILIO_AUTH_TOKEN");
  
  if (sid1 && token1) {
    try {
      const result = await tryTwilioWithCredentials(sid1, token1, phone, startDate, endDate);
      console.log(`Twilio primary: ${result.length} calls found`);
      return result;
    } catch (e) {
      console.error("Twilio primary failed:", e.message);
    }
  }

  // Fallback to secondary credentials
  const sid2 = Deno.env.get("TWILIO_ACCOUNT_SID_2");
  const token2 = Deno.env.get("TWILIO_AUTH_TOKEN_2");
  
  if (sid2 && token2) {
    try {
      const result = await tryTwilioWithCredentials(sid2, token2, phone, startDate, endDate);
      console.log(`Twilio secondary: ${result.length} calls found`);
      return result;
    } catch (e) {
      console.error("Twilio secondary failed:", e.message);
      throw e;
    }
  }

  throw new Error("No valid Twilio credentials configured");
}

async function fetchVapiCalls(phone: string, startDate: string, endDate: string): Promise<CallRecord[]> {
  const apiKey = Deno.env.get("VAPI_API_KEY");
  if (!apiKey) throw new Error("VAPI_API_KEY not configured");

  const params = new URLSearchParams();
  params.set("createdAtGe", new Date(startDate).toISOString());
  params.set("createdAtLe", new Date(endDate + "T23:59:59").toISOString());
  params.set("limit", "1000");

  const url = `https://api.vapi.ai/call?${params.toString()}`;
  console.log("Vapi request URL:", url);
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const rawCalls = Array.isArray(data) ? data : data.results || data.data || [];
  console.log(`Vapi raw calls returned: ${rawCalls.length}`);
  
  const phoneDigits = normalizeDigits(phone);
  const calls: CallRecord[] = [];
  let skippedErrors = 0;

  for (const call of rawCalls) {
    const endedReason = call.endedReason || "";
    const isFailed = endedReason.includes("error") || endedReason.includes("failed");

    // Extract phone numbers - phoneNumber can be object or just phoneNumberId (UUID)
    const fromNumber = call.phoneNumber?.number || call.phoneNumber?.twilioPhoneNumber || "";
    const customerNumber = call.customer?.number || "";
    
    // For filtering, use actual phone numbers (not UUIDs)
    const fromDigits = normalizeDigits(fromNumber);
    const customerDigits = normalizeDigits(customerNumber);
    
    const matchesPhone = !phoneDigits || 
      fromDigits.includes(phoneDigits) || 
      customerDigits.includes(phoneDigits) ||
      (fromDigits && phoneDigits.includes(fromDigits)) ||
      (customerDigits && phoneDigits.includes(customerDigits));
    
    if (!matchesPhone) continue;

    // Calculate duration from startedAt/endedAt
    const durationSec = call.endedAt && call.startedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : call.duration || 0;

    // Extract cost from various possible fields
    const costVal = call.cost ?? call.costBreakdown?.total ?? 0;

    if (isFailed) skippedErrors++;

    calls.push({
      id: call.id,
      phoneFrom: fromNumber || call.phoneNumberId || "",
      phoneTo: customerNumber,
      duration: durationSec,
      cost: typeof costVal === "number" ? costVal : parseFloat(costVal || "0"),
      source: "vapi",
      date: call.startedAt || call.createdAt,
      status: isFailed ? `erro: ${endedReason}` : (call.status || "completed"),
    });
  }

  console.log(`Vapi matched: ${calls.length}, skipped errors: ${skippedErrors} (filter: "${phoneDigits}")`);
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
        const vapiCalls = await fetchVapiCalls(phone || "", startDate, endDate);
        results = results.concat(vapiCalls);
      } catch (e) {
        console.error("Vapi fetch error:", e);
        warnings.push(`Vapi: ${e.message}`);
      }
    }

    // Sort by date desc
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(JSON.stringify({ calls: results, warnings }), {
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

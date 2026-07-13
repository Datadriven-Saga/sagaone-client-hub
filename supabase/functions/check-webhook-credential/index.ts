// Returns { configured: boolean } for a given secret name, so the admin UI
// can render a green/red badge without ever exposing the actual secret value.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Only names actually referenced by the webhook_registry can be probed.
// Prevents this endpoint from becoming a generic "does secret X exist" oracle.
async function isAllowedSecret(supabase: any, name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("webhook_registry")
    .select("credencial_secret_name")
    .eq("credencial_secret_name", name)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Verify JWT + Master role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: prof } = await svc
      .from("profiles")
      .select("tipo_acesso")
      .eq("id", userData.user.id)
      .maybeSingle();
    const allowed = ["Master", "Administrador", "TI"];
    if (!prof?.tipo_acesso || !allowed.includes(prof.tipo_acesso)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const names: string[] = Array.isArray(body?.names) ? body.names : [];
    const result: Record<string, boolean> = {};
    for (const name of names) {
      if (!name || typeof name !== "string") continue;
      const allowed = await isAllowedSecret(svc, name);
      if (!allowed) {
        result[name] = false;
        continue;
      }
      const val = Deno.env.get(name);
      result[name] = Boolean(val && val.length > 0);
    }

    return new Response(JSON.stringify({ configured: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
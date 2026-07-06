import { createClient } from "npm:@supabase/supabase-js@2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_MESSAGE = "Se o email estiver cadastrado e autorizado, você receberá um código.";
const EMAIL_LIMIT_WINDOW_MINUTES = 10;
const IP_LIMIT_WINDOW_MINUTES = 10;
const MAX_EMAIL_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 20;

type ResolveOtpUserRow = {
  user_id: string | null;
  allowed: boolean;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  return forwardedFor || realIp || cfIp || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("send-login-otp missing Supabase environment variables");
    return jsonResponse({ message: GENERIC_MESSAGE }, 200);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let email = "";
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      await supabaseAdmin.from("otp_login_attempts").insert({
        email: email || "invalid",
        ip,
        outcome: "invalid_email",
      });
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    const emailSince = new Date(Date.now() - EMAIL_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const ipSince = new Date(Date.now() - IP_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const [{ count: emailCount, error: emailCountError }, { count: ipCount, error: ipCountError }] = await Promise.all([
      supabaseAdmin
        .from("otp_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", emailSince),
      ip
        ? supabaseAdmin
            .from("otp_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip", ip)
            .gte("created_at", ipSince)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if (emailCountError || ipCountError) {
      console.error("send-login-otp rate-limit query error", emailCountError || ipCountError);
    }

    if ((emailCount ?? 0) >= MAX_EMAIL_ATTEMPTS || (ipCount ?? 0) >= MAX_IP_ATTEMPTS) {
      await supabaseAdmin.from("otp_login_attempts").insert({
        email,
        ip,
        outcome: "rate_limited",
      });
      return jsonResponse({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    }

    const { data: resolvedRows, error: resolveError } = await supabaseAdmin.rpc("resolve_login_otp_user", {
      _email: email,
    });

    if (resolveError) {
      console.error("send-login-otp resolve_login_otp_user error", resolveError);
      await supabaseAdmin.from("otp_login_attempts").insert({ email, ip, outcome: "resolve_error" });
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    const resolved = Array.isArray(resolvedRows) ? (resolvedRows[0] as ResolveOtpUserRow | undefined) : undefined;

    if (!resolved?.user_id || resolved.allowed !== true) {
      await supabaseAdmin.from("otp_login_attempts").insert({
        email,
        ip,
        user_id: resolved?.user_id ?? null,
        outcome: resolved?.user_id ? "denied" : "not_found",
      });
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    const { error: otpError } = await supabaseAuth.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${new URL(req.url).origin}/`,
      },
    });

    if (otpError) {
      console.error("send-login-otp signInWithOtp error", otpError.message);
      await supabaseAdmin.from("otp_login_attempts").insert({
        email,
        ip,
        user_id: resolved.user_id,
        outcome: "send_error",
      });
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    await supabaseAdmin.from("otp_login_attempts").insert({
      email,
      ip,
      user_id: resolved.user_id,
      outcome: "sent",
    });

    return jsonResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("send-login-otp unexpected error", error);
    if (email) {
      await supabaseAdmin.from("otp_login_attempts").insert({ email, ip, outcome: "unexpected_error" });
    }
    return jsonResponse({ message: GENERIC_MESSAGE });
  }
});
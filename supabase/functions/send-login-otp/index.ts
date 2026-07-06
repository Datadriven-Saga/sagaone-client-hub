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
const DEFAULT_FROM_EMAIL = "Saga One <onboarding@resend.dev>";

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

function getRedirectTo(req: Request, bodyRedirectTo: unknown) {
  const origin = req.headers.get("origin") || "";
  const candidate = typeof bodyRedirectTo === "string" ? bodyRedirectTo : `${origin}/`;

  try {
    const url = new URL(candidate);
    const isAllowed =
      url.hostname === "one.sagadatadriven.com.br" ||
      url.hostname === "sagaone-client-hub.lovable.app" ||
      url.hostname.endsWith(".lovable.app") ||
      url.hostname.endsWith(".lovableproject.com") ||
      url.hostname === "localhost";

    return isAllowed ? url.toString() : "https://one.sagadatadriven.com.br/";
  } catch {
    return "https://one.sagadatadriven.com.br/";
  }
}

async function sendOtpEmail(email: string, otp: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  const from = Deno.env.get("LOGIN_OTP_FROM_EMAIL") || DEFAULT_FROM_EMAIL;
  const subject = "Código de acesso Saga One";
  const html = `
    <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px; color: #111827;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="padding: 28px 28px 12px;">
          <h1 style="font-size: 22px; line-height: 1.3; margin: 0 0 12px; color: #111827;">Código de acesso</h1>
          <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px; color: #4b5563;">Use o código abaixo na tela de login do Saga One.</p>
          <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; text-align: center; padding: 18px; border-radius: 10px; background: #eef6ff; color: #0f172a; margin: 20px 0;">${otp}</div>
          <p style="font-size: 13px; line-height: 1.5; margin: 0; color: #6b7280;">Esse código é temporário. Se você não solicitou esse acesso, ignore este email.</p>
        </div>
        <div style="padding: 16px 28px 24px; color: #9ca3af; font-size: 12px;">Saga One</div>
      </div>
    </div>`;

  const text = `Código de acesso Saga One: ${otp}\n\nUse este código na tela de login. Se você não solicitou esse acesso, ignore este email.`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      html,
      text,
    }),
  });

  const resultText = await response.text();
  if (!response.ok) {
    throw new Error(`Resend [${response.status}]: ${resultText}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("send-login-otp missing Supabase environment variables");
    return jsonResponse({ message: GENERIC_MESSAGE }, 200);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let email = "";
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    email = normalizeEmail(body.email);
    const emailRedirectTo = getRedirectTo(req, body.redirectTo);

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

    const { data: linkData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: emailRedirectTo,
      },
    });

    const emailOtp = linkData?.properties?.email_otp;

    if (otpError || !emailOtp) {
      console.error("send-login-otp generateLink error", otpError?.message || "email_otp ausente");
      await supabaseAdmin.from("otp_login_attempts").insert({
        email,
        ip,
        user_id: resolved.user_id,
        outcome: "generate_error",
      });
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    try {
      await sendOtpEmail(email, emailOtp);
    } catch (sendError) {
      console.error("send-login-otp email send error", (sendError as Error).message);
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
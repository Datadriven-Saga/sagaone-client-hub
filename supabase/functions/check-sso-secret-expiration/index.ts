import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function buildHtml(dias: number, expiresAt: string, clientId: string, critico: boolean) {
  const cor = critico ? "#dc2626" : dias <= 30 ? "#ea580c" : "#ca8a04";
  const titulo = critico
    ? `⚠️ Client Secret Azure EXPIRADO há ${Math.abs(dias)} dias`
    : `Client Secret Azure expira em ${dias} dias`;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="color:${cor};margin:0 0 16px">${titulo}</h2>
  <p>O client secret usado para o login SSO Microsoft do Saga One está próximo do vencimento (ou já venceu). Sem renovação, novos logins via SSO deixam de funcionar.</p>
  <ul>
    <li><strong>Client ID:</strong> ${clientId}</li>
    <li><strong>Expira em:</strong> ${new Date(expiresAt).toLocaleString("pt-BR")}</li>
    <li><strong>Dias restantes:</strong> ${dias}</li>
  </ul>
  <h3>Como renovar</h3>
  <ol>
    <li>Acesse o <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/${clientId}">App Registration no Azure</a>.</li>
    <li>Em <strong>Certificates &amp; secrets</strong>, gere um novo Client Secret.</li>
    <li>Copie o <strong>Value</strong> (não o Secret ID).</li>
    <li>No <a href="https://supabase.com/dashboard/project/karcxgnfiymlrkbzhewo/auth/providers">Supabase &gt; Authentication &gt; Providers &gt; Azure</a>, substitua o secret e salve.</li>
    <li>No Saga One em <strong>Administração &gt; SSO</strong>, clique em <strong>Registrar nova rotação</strong>.</li>
  </ol>
  <p style="color:#666;font-size:12px;margin-top:24px">Este alerta é enviado automaticamente pelo Saga One a Master, TI e Administradores.</p>
</div>`;
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY || to.length === 0) return { ok: false, skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Saga One <no-reply@sagadatadriven.com.br>",
      to,
      subject,
      html,
    }),
  });
  const body = await r.text();
  return { ok: r.ok, status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: rotations, error } = await supabase
    .from("sso_secret_rotations")
    .select("*")
    .is("resolved_at", null)
    .lte("alert_at", new Date().toISOString());

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const rot of rotations || []) {
    const dias = daysUntil(rot.expires_at);
    const critico = dias < 0;

    // Reforço: se já alertou nos últimos 7 dias e não é crítico, pula
    if (rot.last_alerted_at && !critico) {
      const diff = Date.now() - new Date(rot.last_alerted_at).getTime();
      if (diff < 7 * 86400000) {
        results.push({ id: rot.id, skipped: "cooldown" });
        continue;
      }
    }
    // Se crítico, alerta diariamente
    if (rot.last_alerted_at && critico) {
      const diff = Date.now() - new Date(rot.last_alerted_at).getTime();
      if (diff < 86400000) {
        results.push({ id: rot.id, skipped: "critico-daily-cooldown" });
        continue;
      }
    }

    // Busca admins
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .in("tipo_acesso", ["Master", "TI", "Administrador"])
      .eq("is_active", true);

    const adminIds = (admins || []).map((a: any) => a.id);

    // Notificação in-app
    const titulo = critico
      ? `SSO Microsoft: secret expirado há ${Math.abs(dias)} dias`
      : `SSO Microsoft: secret expira em ${dias} dias`;
    const mensagem = `Renove o client secret do Azure para não interromper o login SSO.`;

    if (adminIds.length) {
      const rows = adminIds.map((uid) => ({
        user_id: uid,
        destinatario_id: uid,
        tipo: "sso_secret_expirando",
        status: "enviada",
        titulo,
        mensagem,
        link: "/administracao",
        lida: false,
      }));
      await supabase.from("notificacoes").insert(rows);
    }

    // Email
    const { data: emails } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailList = (emails?.users || [])
      .filter((u: any) => adminIds.includes(u.id) && u.email)
      .map((u: any) => u.email as string);

    const html = buildHtml(dias, rot.expires_at, rot.client_id, critico);
    const emailRes = await sendEmail(emailList, `[Saga One] ${titulo}`, html);

    await supabase
      .from("sso_secret_rotations")
      .update({
        last_alerted_at: new Date().toISOString(),
        alert_count: (rot.alert_count || 0) + 1,
      })
      .eq("id", rot.id);

    results.push({ id: rot.id, dias, critico, admins: adminIds.length, emails: emailList.length, emailRes });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
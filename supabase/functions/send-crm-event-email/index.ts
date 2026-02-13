import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SMTP_USER = Deno.env.get("SMTP_USER");

    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromEmail = SMTP_USER || "onboarding@resend.dev";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event_id } = body;

    console.log(`📧 [send-crm-event-email] Recebido event_id: ${event_id}`);

    if (!event_id) {
      console.error("❌ event_id não fornecido");
      return new Response(
        JSON.stringify({ error: "event_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do evento
    const { data: evento, error: eventoError } = await supabase
      .from("prospeccoes")
      .select("id, titulo, descricao, data_inicio, data_fim, canal, empresa_id, responsavel_id")
      .eq("id", event_id)
      .single();

    if (eventoError || !evento) {
      console.error("❌ Evento não encontrado:", eventoError?.message);
      return new Response(
        JSON.stringify({ error: "Evento não encontrado", details: eventoError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Evento encontrado: "${evento.titulo}" (empresa: ${evento.empresa_id})`);

    // Buscar dados da empresa
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_empresa, cnpj, cidade, uf, endereco")
      .eq("id", evento.empresa_id)
      .single();

    console.log(`🏢 Empresa: ${empresa?.nome_empresa || "não encontrada"}`);

    // Buscar nome do responsável
    let responsavelNome = "Sistema";
    if (evento.responsavel_id) {
      const { data: criador } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", evento.responsavel_id)
        .single();
      if (criador?.nome_completo) responsavelNome = criador.nome_completo;
    }

    // Buscar TODOS os usuários com tipo_acesso = 'CRM' (global, sem filtro de empresa)
    // profiles não tem coluna email, então buscamos de auth.users via admin API
    const { data: crmProfiles } = await supabase
      .from("profiles")
      .select("id, nome_completo")
      .eq("tipo_acesso", "CRM");

    let destinatarios: { id: string; nome_completo: string; email: string }[] = [];

    if (crmProfiles && crmProfiles.length > 0) {
      // Buscar emails de auth.users para cada CRM profile
      for (const p of crmProfiles) {
        const { data: userData } = await supabase.auth.admin.getUserById(p.id);
        const email = userData?.user?.email;
        if (email && email.trim() !== "") {
          destinatarios.push({
            id: p.id,
            nome_completo: p.nome_completo || "",
            email,
          });
        }
      }
    }
    console.log(`👥 CRMs encontrados: ${destinatarios.length}`);

    if (destinatarios.length === 0) {
      console.log("⚠️ Nenhum destinatário CRM encontrado");
      await supabase.from("logs_notificacoes_email").insert({
        tipo: "send_crm_event_email",
        referencia_id: event_id,
        referencia_tipo: "prospeccao",
        destinatario_email: "nenhum",
        destinatario_nome: "Nenhum CRM encontrado",
        assunto: `Novo Evento - ${evento.titulo}`,
        status: "sem_destinatario",
        erro: "Nenhum usuário CRM vinculado à empresa",
        empresa_id: evento.empresa_id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Nenhum destinatário CRM encontrado", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar HTML do email
    const formatDate = (d?: string) => {
      if (!d) return "Não informada";
      try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
    };

    const nomeEmpresa = empresa?.nome_empresa || "Não informada";
    const cnpjEmpresa = empresa?.cnpj || "";
    const cidadeEmpresa = empresa?.cidade || "";
    const ufEmpresa = empresa?.uf || "";
    const enderecoEmpresa = empresa?.endereco || "";
    const assunto = `Novo Evento Criado – Ação Necessária CRM`;

    const corpoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a1a2e; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">📢 Novo Evento Criado</h2>
          <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Ação Necessária – Equipe CRM</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Olá,<br><br>
            Um novo evento foi criado no sistema e requer ação da equipe de CRM.
          </p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 140px;">Código da Loja:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${cnpjEmpresa}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Nome da Loja:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${nomeEmpresa}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Evento:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${evento.titulo}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Início:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(evento.data_inicio)}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Fim:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(evento.data_fim)}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Local:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${enderecoEmpresa}${cidadeEmpresa ? ` - ${cidadeEmpresa}` : ""}${ufEmpresa ? `/${ufEmpresa}` : ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Responsável:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${responsavelNome}</td></tr>
            </table>
          </div>
          ${evento.descricao ? `<div style="margin: 16px 0;"><p style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Descrição:</p><p style="color: #374151; font-size: 14px; line-height: 1.5; background: #f9fafb; padding: 12px; border-radius: 6px;">${evento.descricao}</p></div>` : ""}
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">⚠️ Solicitamos que a equipe de CRM realize a <strong>subida da base</strong> correspondente a este evento o mais breve possível.</p>
          </div>
        </div>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">Saga One – Sistema de Prospecção e CRM</p>
        </div>
      </div>`;

    // Enviar via Resend API (HTTP - compatível com Edge Functions)
    let enviados = 0;
    let erros = 0;
    const logs: Array<any> = [];

    for (const dest of destinatarios) {
      try {
        console.log(`📤 Enviando email para: ${dest.email}`);

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Saga One <${fromEmail}>`,
            to: [dest.email],
            subject: assunto,
            html: corpoHtml,
          }),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          throw new Error(resendData?.message || `HTTP ${resendRes.status}`);
        }

        console.log(`✅ Email enviado com sucesso para ${dest.email}`);
        enviados++;
        logs.push({
          tipo: "send_crm_event_email",
          referencia_id: event_id,
          referencia_tipo: "prospeccao",
          destinatario_email: dest.email,
          destinatario_nome: dest.nome_completo || "",
          assunto,
          status: "enviado",
          erro: null,
          empresa_id: evento.empresa_id,
        });
      } catch (emailErr) {
        erros++;
        const errMsg = (emailErr as Error).message;
        console.error(`❌ Falha para ${dest.email}: ${errMsg}`);
        logs.push({
          tipo: "send_crm_event_email",
          referencia_id: event_id,
          referencia_tipo: "prospeccao",
          destinatario_email: dest.email,
          destinatario_nome: dest.nome_completo || "",
          assunto,
          status: "erro",
          erro: errMsg,
          empresa_id: evento.empresa_id,
        });
      }
    }

    if (logs.length > 0) {
      const { error: logError } = await supabase.from("logs_notificacoes_email").insert(logs);
      if (logError) console.error("❌ Erro ao salvar logs:", logError.message);
      else console.log(`✅ ${logs.length} log(s) salvos`);
    }

    console.log(`📧 Resultado: ${enviados} enviados, ${erros} erros de ${destinatarios.length} destinatários`);

    return new Response(
      JSON.stringify({ success: true, enviados, erros, total_destinatarios: destinatarios.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro geral:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

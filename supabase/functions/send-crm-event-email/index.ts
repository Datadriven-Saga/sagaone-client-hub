import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// n8n desativado - agora usando Resend diretamente
// const N8N_WEBHOOK_URL = "https://automatemaiawh.sagadatadriven.com.br/webhook/evento-crm-email";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não configurada");
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event_id } = body;

    console.log(`📧 [send-crm-event-email] Recebido event_id: ${event_id}`);

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: "event_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar evento
    const { data: evento, error: eventoError } = await supabase
      .from("prospeccoes")
      .select("id, titulo, descricao, data_inicio, data_fim, empresa_id")
      .eq("id", event_id)
      .single();

    if (eventoError || !evento) {
      console.error("❌ Evento não encontrado:", eventoError?.message);
      return new Response(
        JSON.stringify({ error: "Evento não encontrado", details: eventoError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Evento: "${evento.titulo}" (empresa: ${evento.empresa_id})`);

    // 2. Buscar empresa
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_empresa, cnpj, crm_id, marca, cidade, uf, endereco")
      .eq("id", evento.empresa_id)
      .single();

    console.log(`🏢 Empresa: ${empresa?.nome_empresa || "não encontrada"} (${empresa?.cnpj || "sem CNPJ"})`);

    // 3. Lista fixa de destinatários CRM
    const emails: string[] = [
      "maria.frezende@gruposaga.com.br",
      "sabrina.mqueiroz@gruposaga.com.br",
      "victor.hferreira@gruposaga.com.br",
      "moises.salves@gruposaga.com.br",
      "ellen.pdias@gruposaga.com.br",
      "rainny.emachado@gruposaga.com.br",
      "mayara.salmeida@gruposaga.com.br",
    ];

    console.log(`👥 CRMs com email válido: ${emails.length}`);

    if (emails.length === 0) {
      console.log("⚠️ Nenhum CRM encontrado");
      await supabase.from("logs_notificacoes_email").insert({
        tipo: "send_crm_event_email",
        referencia_id: event_id,
        referencia_tipo: "prospeccao",
        destinatario_email: "nenhum",
        destinatario_nome: "Nenhum CRM encontrado",
        assunto: `Novo Evento - ${evento.titulo}`,
        status: "sem_destinatario",
        erro: "Nenhum usuário CRM com email válido",
        empresa_id: evento.empresa_id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Nenhum CRM encontrado", enviados: 0, erros: 0, total_destinatarios: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Formatar datas
    const formatDate = (d?: string) => {
      if (!d) return "Não informada";
      try {
        return new Date(d).toLocaleDateString("pt-BR");
      } catch {
        return d;
      }
    };

    const nomeEmpresa = empresa?.nome_empresa || "Não informada";
    const cnpjEmpresa = empresa?.cnpj || "";
    const cidadeEmpresa = empresa?.cidade || "";
    const ufEmpresa = empresa?.uf || "";
    const enderecoEmpresa = empresa?.endereco || "";

    const assunto = `Novo Evento Criado – Ação Necessária CRM`;

    // 5. Montar HTML do email
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

    // 6. Enviar via Resend batch (uma única chamada para todos os destinatários)
    let enviados = 0;
    let erros = 0;
    const logs: Array<any> = [];

    try {
      console.log(`📤 Enviando email via Resend Batch para ${emails.length} destinatários`);

      const batchPayload = emails.map((email) => ({
        from: "Saga One <admin@sagadatadriven.com.br>",
        to: [email],
        subject: assunto,
        html: corpoHtml,
      }));

      const emailRes = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchPayload),
      });

      const emailResult = await emailRes.json();
      console.log(`📨 Resposta Resend Batch: status=${emailRes.status}`, JSON.stringify(emailResult));

      if (emailRes.ok && emailResult.data) {
        // Batch retorna array de { id } para cada email enviado
        const results = emailResult.data as Array<{ id: string }>;
        for (let i = 0; i < emails.length; i++) {
          const result = results[i];
          if (result?.id) {
            enviados++;
            logs.push({
              tipo: "send_crm_event_email",
              referencia_id: event_id,
              referencia_tipo: "prospeccao",
              destinatario_email: emails[i],
              destinatario_nome: emails[i],
              assunto,
              status: "enviado",
              erro: null,
              empresa_id: evento.empresa_id,
            });
          } else {
            erros++;
            logs.push({
              tipo: "send_crm_event_email",
              referencia_id: event_id,
              referencia_tipo: "prospeccao",
              destinatario_email: emails[i],
              destinatario_nome: emails[i],
              assunto,
              status: "erro",
              erro: "Sem ID de retorno no batch",
              empresa_id: evento.empresa_id,
            });
          }
        }
      } else {
        // Falha geral do batch
        const erroMsg = emailResult.message || JSON.stringify(emailResult);
        console.error(`❌ Falha no batch: ${erroMsg}`);
        erros = emails.length;
        for (const email of emails) {
          logs.push({
            tipo: "send_crm_event_email",
            referencia_id: event_id,
            referencia_tipo: "prospeccao",
            destinatario_email: email,
            destinatario_nome: email,
            assunto,
            status: "erro",
            erro: erroMsg,
            empresa_id: evento.empresa_id,
          });
        }
      }
    } catch (batchErr) {
      const errMsg = (batchErr as Error).message;
      console.error(`❌ Exceção no batch: ${errMsg}`);
      erros = emails.length;
      for (const email of emails) {
        logs.push({
          tipo: "send_crm_event_email",
          referencia_id: event_id,
          referencia_tipo: "prospeccao",
          destinatario_email: email,
          destinatario_nome: email,
          assunto,
          status: "erro",
          erro: errMsg,
          empresa_id: evento.empresa_id,
        });
      }
    }

    // 7. Salvar logs
    if (logs.length > 0) {
      const { error: logError } = await supabase.from("logs_notificacoes_email").insert(logs);
      if (logError) {
        console.error("❌ Erro ao salvar logs:", logError.message);
      } else {
        console.log(`✅ ${logs.length} log(s) salvos`);
      }
    }

    console.log(`📧 Resultado: ${enviados} enviados, ${erros} erros de ${emails.length} destinatários`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        erros,
        total_destinatarios: emails.length,
        message: `Resend: ${enviados} enviado(s), ${erros} erro(s)`,
      }),
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

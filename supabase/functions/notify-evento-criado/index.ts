import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EventoPayload {
  prospeccao_id: string;
  titulo: string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
  canal?: string;
  empresa_id: string;
  criado_por_id?: string;
  tipo?: string;
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("❌ Auth header ausente");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      console.error("❌ Token inválido:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: EventoPayload = await req.json();
    const { prospeccao_id, titulo, descricao, data_inicio, data_fim, empresa_id } = payload;
    const tipoNotificacao = payload.tipo || "evento_criado";
    const isEdicao = tipoNotificacao === "evento_editado";

    console.log(`📧 Iniciando notificação: tipo=${tipoNotificacao}, titulo="${titulo}", empresa=${empresa_id}`);

    if (!prospeccao_id || !empresa_id || !titulo) {
      console.error("❌ Campos obrigatórios faltando:", { prospeccao_id, empresa_id, titulo });
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados da empresa
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_empresa, cnpj, cidade, uf, endereco")
      .eq("id", empresa_id)
      .single();

    console.log(`🏢 Empresa: ${empresa?.nome_empresa || "não encontrada"}`);

    // Buscar nome do criador
    const { data: criador } = await supabase
      .from("profiles")
      .select("nome_completo, email")
      .eq("id", claimsData.user.id)
      .single();

    // Buscar usuários CRM vinculados à empresa via user_empresas
    const { data: usuariosCRM, error: errCRM } = await supabase
      .from("user_empresas")
      .select("user_id, profiles!inner(id, nome_completo, email, tipo_acesso)")
      .eq("empresa_id", empresa_id);

    if (errCRM) {
      console.error("❌ Erro ao buscar usuários CRM via user_empresas:", errCRM.message);
    }

    let destinatarios: { id: string; nome_completo: string; email: string }[] = [];

    if (usuariosCRM) {
      for (const ue of usuariosCRM) {
        const profile = ue.profiles as any;
        if (profile && profile.tipo_acesso === "CRM" && profile.email) {
          destinatarios.push({
            id: profile.id,
            nome_completo: profile.nome_completo || "",
            email: profile.email,
          });
        }
      }
    }

    console.log(`👥 CRMs via user_empresas: ${destinatarios.length}`);

    // Fallback: buscar CRMs pelo profile.empresa_id
    const { data: crmProfiles } = await supabase
      .from("profiles")
      .select("id, nome_completo, email")
      .eq("empresa_id", empresa_id)
      .eq("tipo_acesso", "CRM");

    if (crmProfiles) {
      const idsExistentes = new Set(destinatarios.map((d) => d.id));
      for (const p of crmProfiles) {
        if (p.email && !idsExistentes.has(p.id)) {
          destinatarios.push(p);
        }
      }
    }

    console.log(`👥 CRMs total (com fallback): ${destinatarios.length}`);

    destinatarios = destinatarios.filter((d) => d.email && d.email.trim() !== "");

    if (destinatarios.length === 0) {
      console.log("⚠️ Nenhum destinatário CRM encontrado para empresa", empresa_id);

      // Registrar log mesmo sem destinatários
      await supabase.from("logs_notificacoes_email").insert({
        tipo: tipoNotificacao,
        referencia_id: prospeccao_id,
        referencia_tipo: "prospeccao",
        destinatario_email: "nenhum",
        destinatario_nome: "Nenhum CRM encontrado",
        assunto: `${isEdicao ? "Evento Editado" : "Novo Evento"} - ${titulo}`,
        status: "sem_destinatario",
        erro: "Nenhum usuário CRM vinculado à empresa",
        empresa_id,
        enviado_por: claimsData.user.id,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Nenhum destinatário CRM encontrado", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 Destinatários: ${destinatarios.map(d => d.email).join(", ")}`);

    const formatDate = (d?: string) => {
      if (!d) return "Não informada";
      try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
    };

    const nomeEmpresa = empresa?.nome_empresa || "Não informada";
    const cnpjEmpresa = empresa?.cnpj || "";
    const cidadeEmpresa = empresa?.cidade || "";
    const ufEmpresa = empresa?.uf || "";
    const enderecoEmpresa = empresa?.endereco || "";
    const responsavel = criador?.nome_completo || "Sistema";

    const assunto = isEdicao
      ? `Evento Editado – Ação Necessária CRM`
      : `Novo Evento Criado – Ação Necessária CRM`;

    const corpoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a1a2e; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">${isEdicao ? "✏️ Evento Editado" : "📢 Novo Evento Criado"}</h2>
          <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Ação Necessária – Equipe CRM</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Olá,<br><br>
            ${isEdicao ? "Um evento foi editado no sistema e requer atenção da equipe de CRM." : "Um novo evento foi criado no sistema e requer ação da equipe de CRM."}
          </p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 140px;">Código da Loja:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${cnpjEmpresa}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Nome da Loja:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${nomeEmpresa}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Evento:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${titulo}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Início:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(data_inicio)}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Fim:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(data_fim)}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Local:</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${enderecoEmpresa}${cidadeEmpresa ? ` - ${cidadeEmpresa}` : ""}${ufEmpresa ? `/${ufEmpresa}` : ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Responsável:</td><td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${responsavel}</td></tr>
            </table>
          </div>
          ${descricao ? `<div style="margin: 16px 0;"><p style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Descrição:</p><p style="color: #374151; font-size: 14px; line-height: 1.5; background: #f9fafb; padding: 12px; border-radius: 6px;">${descricao}</p></div>` : ""}
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">⚠️ Solicitamos que a equipe de CRM realize a <strong>subida da base</strong> correspondente a este evento o mais breve possível.</p>
          </div>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">Em caso de dúvidas, entrar em contato com o responsável pelo evento.</p>
        </div>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">Saga One – Sistema de Prospecção e CRM</p>
        </div>
      </div>`;

    let enviados = 0;
    let erros = 0;
    const logs: Array<any> = [];

    for (const dest of destinatarios) {
      try {
        console.log(`📤 Enviando email para: ${dest.email}`);

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Saga One <onboarding@resend.dev>",
            to: [dest.email],
            subject: assunto,
            html: corpoHtml,
          }),
        });

        const emailResult = await emailRes.json();
        console.log(`📨 Resposta Resend para ${dest.email}: status=${emailRes.status}`, JSON.stringify(emailResult));

        if (emailRes.ok && emailResult.id) {
          enviados++;
          logs.push({
            tipo: tipoNotificacao,
            referencia_id: prospeccao_id,
            referencia_tipo: "prospeccao",
            destinatario_email: dest.email,
            destinatario_nome: dest.nome_completo || "",
            assunto,
            status: "enviado",
            erro: null,
            empresa_id,
            enviado_por: claimsData.user.id,
          });
        } else {
          erros++;
          const erroMsg = emailResult.message || emailResult.statusCode
            ? `Resend [${emailRes.status}]: ${emailResult.message || JSON.stringify(emailResult)}`
            : JSON.stringify(emailResult);
          console.error(`❌ Falha ao enviar para ${dest.email}: ${erroMsg}`);
          logs.push({
            tipo: tipoNotificacao,
            referencia_id: prospeccao_id,
            referencia_tipo: "prospeccao",
            destinatario_email: dest.email,
            destinatario_nome: dest.nome_completo || "",
            assunto,
            status: "erro",
            erro: erroMsg,
            empresa_id,
            enviado_por: claimsData.user.id,
          });
        }
      } catch (emailErr) {
        erros++;
        const errMsg = (emailErr as Error).message;
        console.error(`❌ Exceção ao enviar para ${dest.email}: ${errMsg}`);
        logs.push({
          tipo: tipoNotificacao,
          referencia_id: prospeccao_id,
          referencia_tipo: "prospeccao",
          destinatario_email: dest.email,
          destinatario_nome: dest.nome_completo || "",
          assunto,
          status: "erro",
          erro: errMsg,
          empresa_id,
          enviado_por: claimsData.user.id,
        });
      }
    }

    // Inserir logs
    if (logs.length > 0) {
      const { error: logError } = await supabase.from("logs_notificacoes_email").insert(logs);
      if (logError) {
        console.error("❌ Erro ao salvar logs:", logError.message);
      } else {
        console.log(`✅ ${logs.length} log(s) salvos com sucesso`);
      }
    }

    console.log(`📧 Resultado final: ${enviados} enviados, ${erros} erros de ${destinatarios.length} destinatários`);

    return new Response(
      JSON.stringify({ success: true, enviados, erros, total_destinatarios: destinatarios.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro na notificação de evento:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

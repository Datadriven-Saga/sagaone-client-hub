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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: EventoPayload = await req.json();
    const {
      prospeccao_id,
      titulo,
      descricao,
      data_inicio,
      data_fim,
      empresa_id,
    } = payload;

    if (!prospeccao_id || !empresa_id || !titulo) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar dados da empresa (loja)
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_empresa, cnpj, cidade, uf, endereco")
      .eq("id", empresa_id)
      .single();

    // Buscar nome do criador
    const { data: criador } = await supabase
      .from("profiles")
      .select("nome_completo, email")
      .eq("id", claimsData.user.id)
      .single();

    // Buscar usuários CRM (tipo_acesso = CRM) vinculados à empresa via user_empresas
    const { data: usuariosCRM } = await supabase
      .from("user_empresas")
      .select("user_id, profiles!inner(id, nome_completo, email, tipo_acesso)")
      .eq("empresa_id", empresa_id);

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

    // Também buscar CRMs pela empresa_id do profile (fallback)
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

    // Filtrar destinatários sem email
    destinatarios = destinatarios.filter(
      (d) => d.email && d.email.trim() !== ""
    );

    if (destinatarios.length === 0) {
      console.log("Nenhum destinatário CRM encontrado para empresa", empresa_id);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum destinatário CRM encontrado",
          enviados: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Formatar datas
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
    const responsavel = criador?.nome_completo || "Sistema";

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
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 140px;">Código da Loja:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${cnpjEmpresa}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Nome da Loja:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${nomeEmpresa}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Evento:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${titulo}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Início:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(data_inicio)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Data Fim:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px;">${formatDate(data_fim)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Local:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px;">${enderecoEmpresa}${cidadeEmpresa ? ` - ${cidadeEmpresa}` : ""}${ufEmpresa ? `/${ufEmpresa}` : ""}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Responsável:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${responsavel}</td>
              </tr>
            </table>
          </div>
          
          ${
            descricao
              ? `
          <div style="margin: 16px 0;">
            <p style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Descrição:</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.5; background: #f9fafb; padding: 12px; border-radius: 6px;">${descricao}</p>
          </div>
          `
              : ""
          }
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">
              ⚠️ Solicitamos que a equipe de CRM realize a <strong>subida da base</strong> correspondente a este evento o mais breve possível.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
            Em caso de dúvidas, entrar em contato com o responsável pelo evento.
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Saga One – Sistema de Prospecção e CRM
          </p>
        </div>
      </div>
    `;

    // Enviar emails individualmente e registrar logs
    let enviados = 0;
    let erros = 0;
    const logs: Array<{
      tipo: string;
      referencia_id: string;
      referencia_tipo: string;
      destinatario_email: string;
      destinatario_nome: string;
      assunto: string;
      status: string;
      erro: string | null;
      empresa_id: string;
      enviado_por: string;
    }> = [];

    for (const dest of destinatarios) {
      try {
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

        if (emailRes.ok) {
          enviados++;
          logs.push({
            tipo: "evento_criado",
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
          logs.push({
            tipo: "evento_criado",
            referencia_id: prospeccao_id,
            referencia_tipo: "prospeccao",
            destinatario_email: dest.email,
            destinatario_nome: dest.nome_completo || "",
            assunto,
            status: "erro",
            erro: JSON.stringify(emailResult),
            empresa_id,
            enviado_por: claimsData.user.id,
          });
        }
      } catch (emailErr) {
        erros++;
        logs.push({
          tipo: "evento_criado",
          referencia_id: prospeccao_id,
          referencia_tipo: "prospeccao",
          destinatario_email: dest.email,
          destinatario_nome: dest.nome_completo || "",
          assunto,
          status: "erro",
          erro: (emailErr as Error).message,
          empresa_id,
          enviado_por: claimsData.user.id,
        });
      }
    }

    // Inserir logs no banco
    if (logs.length > 0) {
      await supabase.from("logs_notificacoes_email").insert(logs);
    }

    console.log(
      `📧 Notificação evento "${titulo}": ${enviados} enviados, ${erros} erros`
    );

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        erros,
        total_destinatarios: destinatarios.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro na notificação de evento:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

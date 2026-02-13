import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const N8N_WEBHOOK_URL = "https://automatemaiawh.sagadatadriven.com.br/webhook/evento-crm-email";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // 2. Buscar empresa com dados completos
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_empresa, cnpj, crm_id, marca, cidade, uf")
      .eq("id", evento.empresa_id)
      .single();

    console.log(`🏢 Empresa: ${empresa?.nome_empresa || "não encontrada"} (${empresa?.cnpj || "sem CNPJ"})`);
    // 3. Lista fixa de destinatários CRM para notificações de eventos
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

    // 4. Formatar data como DDMMAAAA
    let dataFormatada = "";
    if (evento.data_inicio) {
      const d = new Date(evento.data_inicio);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const aaaa = String(d.getUTCFullYear());
      dataFormatada = `${dd}${mm}${aaaa}`;
    }

    // 5. Montar payload enriquecido para n8n
    const payload = {
      evento: {
        nome: evento.titulo || "",
        data: dataFormatada,
        descricao: evento.descricao || "",
      },
      empresa: {
        dealer_id: empresa?.crm_id || "",
        nome: empresa?.nome_empresa || "",
        cnpj: empresa?.cnpj || "",
        marca: empresa?.marca || "",
        cidade: empresa?.cidade || "",
        uf: empresa?.uf || "",
      },
      crms: emails,
    };

    console.log(`📤 Enviando para n8n: ${emails.length} CRMs`);

    // 5. Chamar webhook n8n
    const webhookRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const webhookBody = await webhookRes.text();
    console.log(`📨 n8n response status: ${webhookRes.status}, body: ${webhookBody}`);

    const sucesso = webhookRes.ok;

    // 6. Logar resultado
    await supabase.from("logs_notificacoes_email").insert({
      tipo: "send_crm_event_email",
      referencia_id: event_id,
      referencia_tipo: "prospeccao",
      destinatario_email: emails.join(", "),
      destinatario_nome: `${emails.length} CRM(s)`,
      assunto: `Novo Evento - ${evento.titulo}`,
      status: sucesso ? "enviado" : "erro",
      erro: sucesso ? null : `n8n HTTP ${webhookRes.status}: ${webhookBody.substring(0, 500)}`,
      empresa_id: evento.empresa_id,
    });

    return new Response(
      JSON.stringify({
        success: sucesso,
        enviados: sucesso ? emails.length : 0,
        erros: sucesso ? 0 : emails.length,
        total_destinatarios: emails.length,
        message: sucesso ? `Webhook enviado com ${emails.length} CRM(s)` : `Webhook falhou: HTTP ${webhookRes.status}`,
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

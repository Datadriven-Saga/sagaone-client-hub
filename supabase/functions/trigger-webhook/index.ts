import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS
const allowedOrigins = [
  'https://one.sagadatadriven.com.br',
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovableproject.com',
  'https://id-preview--7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '')) || origin === allowed);
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user info from JWT
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false
        },
        global: {
          headers: authHeader ? { authorization: authHeader } : {}
        }
      }
    );

    // Get user info for audit logs
    const { data: { user } } = await supabaseClient.auth.getUser(jwt);
    const userId = user?.id;
    const userEmail = user?.email;
    
    console.log(`API trigger-webhook accessed by user: ${userEmail} (${userId})`);
    console.log(`Webhook trigger request body:`, await req.clone().json());

    const { gatilho, dados } = await req.json();

    console.log('🎯 Trigger webhook called with:', { gatilho, dados });
    console.log('🔍 Request body parsed successfully');

    if (!gatilho || !dados) {
      return new Response(
        JSON.stringify({ error: 'gatilho e dados são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extrair empresa_id dos dados para filtrar gatilhos corretamente
    const empresaId = dados.empresa_id;
    console.log('🏢 Empresa ID recebido:', empresaId);

    // Criar cliente com service role para bypessar RLS e buscar gatilhos da empresa correta
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Buscar gatilhos ativos para o tipo de evento E para a empresa específica
    let gatilhosQuery = supabaseServiceClient
      .from('gatilhos')
      .select('*')
      .eq('acoes->>tipo_evento', gatilho)
      .eq('status', 'Ativo');
    
    // Se temos empresa_id, filtrar por ela
    if (empresaId) {
      gatilhosQuery = gatilhosQuery.eq('empresa_id', empresaId);
    }
    
    const { data: gatilhos, error } = await gatilhosQuery;

    console.log(`🔍 Gatilhos query - empresa_id: ${empresaId}, tipo_evento: ${gatilho}`);

    // Buscar também followups ativos de agentes para o tipo de evento
    // Incluir verificação se o agente está ativo
    let followupsQuery = supabaseServiceClient
      .from('agente_followups')
      .select(`
        *,
        agentes_ia!inner(
          id,
          ativo
        )
      `)
      .eq('tipo', gatilho)
      .eq('ativo', true)
      .eq('agentes_ia.ativo', true);
    
    // Se temos empresa_id, filtrar por ela
    if (empresaId) {
      followupsQuery = followupsQuery.eq('empresa_id', empresaId);
    }
    
    const { data: followups, error: followupError } = await followupsQuery;

    // Variáveis para dados do agente PRI
    let agenteData: { telefone: string | null; dealer_id: string | null } | null = null;

    // Se for novo contato na prospecção, verificar se é canal Whatsapp e buscar dados do agente
    if (gatilho === 'novo_contato_prospeccao' && dados?.prospeccao_id) {
      const { data: prospeccao } = await supabaseClient
        .from('prospeccoes')
        .select('canal, empresa_id')
        .eq('id', dados.prospeccao_id)
        .single();
      
      // Só dispara webhook se for canal Whatsapp
      if (prospeccao?.canal !== 'Whatsapp') {
        console.log('Webhook não disparado: campanha não é do canal Whatsapp');
        return new Response(
          JSON.stringify({
            success: true,
            gatilho: gatilho,
            message: 'Webhook não disparado: campanha de ligação não dispara webhook automaticamente',
            webhooks_disparados: 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Buscar dados do agente ativo da empresa (PRI)
      if (prospeccao?.empresa_id) {
        const { data: agente } = await supabaseClient
          .from('agentes_ia')
          .select('telefone, dealer_id')
          .eq('empresa_id', prospeccao.empresa_id)
          .eq('ativo', true)
          .limit(1)
          .single();
        
        if (agente) {
          agenteData = {
            telefone: agente.telefone,
            dealer_id: agente.dealer_id
          };
          console.log('📱 Dados do agente PRI encontrados:', agenteData);
        } else {
          console.log('⚠️ Nenhum agente ativo encontrado para a empresa');
        }
      }
    }

    if (error) {
      console.error('Erro ao buscar gatilhos:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar gatilhos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (followupError) {
      console.error('Erro ao buscar followups:', followupError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar followups' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Gatilhos encontrados: ${gatilhos?.length || 0}`);
    console.log(`Followups encontrados: ${followups?.length || 0}`);
    
    const totalTriggers = (gatilhos?.length || 0) + (followups?.length || 0);
    
    if (totalTriggers === 0) {
      console.log('Nenhum gatilho ou followup encontrado para:', gatilho);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum gatilho ou followup ativo encontrado para este evento',
          gatilho: gatilho,
          webhooks_disparados: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhooksDispareados = [];
    let webhookResponseData: any = null;

    // Processar gatilhos da tabela gatilhos
    for (const gatilhoItem of gatilhos || []) {
      try {
        const acoes = gatilhoItem.acoes || {};
        const webhookUrl = acoes.webhook_url;

        if (!webhookUrl) {
          console.log(`Gatilho ${gatilhoItem.nome} não possui webhook_url configurado`);
          continue;
        }

        console.log(`Disparando webhook gatilho: ${webhookUrl}`);
        console.log(`Descrição do gatilho: ${gatilhoItem.descricao}`);
        
        // Preparar dados do webhook baseado na descrição e tipo do gatilho
        let webhookBody: any = {
          gatilho: gatilho,
          gatilho_id: gatilhoItem.id,
          gatilho_nome: gatilhoItem.nome,
          timestamp: new Date().toISOString()
        };

        // Para gatilho de novo contato na prospecção
        if (gatilho === 'novo_contato_prospeccao' && dados) {
          webhookBody = {
            ...webhookBody,
            nome: dados.nome || '',
            telefone: dados.telefone || '',
            email: dados.email || '',
            id: dados.contato_id || dados.id || '',
            status: dados.status || 'Novo',
            prospeccao_id: dados.prospeccao_id || '',
    // Dados do agente PRI
            telefone_pri: agenteData?.telefone || '',
            dealerId: agenteData?.dealer_id || ''
          };
        }
        // Para novo_template_whatsapp, enviar os dados diretamente no body
        else if (gatilho === 'novo_template_whatsapp' && dados) {
          webhookBody = {
            ...webhookBody,
            ...dados // Espalha os dados diretamente no body
          };
        }
        // Para outros gatilhos, incluir dados completos
        else {
          webhookBody = {
            ...webhookBody,
            dados: dados
          };
        }

        console.log('Webhook body:', JSON.stringify(webhookBody, null, 2));
        
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookBody)
        });

        // Capturar resposta do webhook para retornar ao cliente
        let responseBody: any = null;
        try {
          const responseText = await webhookResponse.text();
          console.log(`Resposta do webhook (${webhookResponse.status}):`, responseText);
          responseBody = JSON.parse(responseText);
          
          // Se for webhook de template e tiver dados do Meta, armazenar
          if (gatilho === 'novo_template_whatsapp' && responseBody) {
            webhookResponseData = responseBody;
          }
        } catch (parseErr) {
          console.log('Resposta do webhook não é JSON válido');
        }

        webhooksDispareados.push({
          gatilho: gatilhoItem.nome,
          url: webhookUrl,
          status: 'disparado',
          response: webhookResponse.status,
          response_data: responseBody
        });
        
        console.log(`Webhook disparado com sucesso para: ${gatilhoItem.nome}`);

        // Atualizar última execução
        await supabaseClient
          .from('gatilhos')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('id', gatilhoItem.id);

      } catch (error) {
        console.error(`Erro ao disparar webhook para ${gatilhoItem.nome}:`, error);
        webhooksDispareados.push({
          gatilho: gatilhoItem.nome,
          url: gatilhoItem.acoes?.webhook_url || 'N/A',
          status: 'erro',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Processar followups da tabela agente_followups
    for (const followupItem of followups || []) {
      try {
        const webhookUrl = followupItem.webhook_url;
        
        if (!webhookUrl) {
          console.log(`Followup ${followupItem.nome} não possui webhook_url configurado`);
          continue;
        }

        console.log(`Disparando webhook followup para: ${followupItem.nome} em ${webhookUrl}`);

        let webhookBody: any = {
          gatilho: gatilho,
          followup_id: followupItem.id,
          followup_nome: followupItem.nome,
          agente_id: followupItem.agente_id,
          timestamp: new Date().toISOString()
        };

        // Para gatilho de novo contato na prospecção
        if (gatilho === 'novo_contato_prospeccao' && dados) {
          webhookBody = {
            ...webhookBody,
            nome: dados.nome || '',
            telefone: dados.telefone || '',
            email: dados.email || '',
            status: dados.status || '',
            prospeccao_id: dados.prospeccao_id || '',
            // Dados do agente PRI
            telefone_pri: agenteData?.telefone || '',
            dealerId: agenteData?.dealer_id || '',
            timestamp: new Date().toISOString()
          };
        }

        console.log('Body:', JSON.stringify(webhookBody, null, 2));

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookBody)
        });

        webhooksDispareados.push({
          gatilho: followupItem.nome,
          url: webhookUrl,
          status: 'disparado',
          response: response.status
        });
        
        console.log(`Webhook followup disparado com sucesso para: ${followupItem.nome}`);

      } catch (error) {
        console.error(`Erro ao disparar webhook followup para ${followupItem.nome}:`, error);
        webhooksDispareados.push({
          gatilho: followupItem.nome,
          url: followupItem.webhook_url || 'N/A',
          status: 'erro',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gatilho: gatilho,
        webhooks_disparados: webhooksDispareados.length,
        detalhes: webhooksDispareados,
        webhook_response: webhookResponseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na função trigger-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
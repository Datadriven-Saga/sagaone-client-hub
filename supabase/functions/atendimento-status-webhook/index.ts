import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-status-sagaone';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    const { telefone_lead, status, empresa_id, evento } = await req.json();

    console.log('📞 Atendimento Status Webhook chamado:', { telefone_lead, status, empresa_id, evento });

    if (!telefone_lead || !status) {
      return new Response(
        JSON.stringify({ error: 'telefone_lead e status são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar dados do agente PRI (agente com nome "Pri" ou primeiro ativo)
    let agenteQuery = supabaseClient
      .from('agentes_ia')
      .select('telefone, dealer_id, nome')
      .eq('ativo', true);
    
    if (empresa_id) {
      agenteQuery = agenteQuery.eq('empresa_id', empresa_id);
    }
    
    // Primeiro tenta encontrar agente chamado "Pri"
    const { data: agentePri } = await supabaseClient
      .from('agentes_ia')
      .select('telefone, dealer_id, nome')
      .eq('ativo', true)
      .eq('empresa_id', empresa_id)
      .ilike('nome', '%pri%')
      .limit(1)
      .single();

    let agenteData = agentePri;
    
    // Se não encontrar "Pri", pega o primeiro agente ativo
    if (!agenteData) {
      const { data: primeiroAgente } = await supabaseClient
        .from('agentes_ia')
        .select('telefone, dealer_id, nome')
        .eq('ativo', true)
        .eq('empresa_id', empresa_id)
        .limit(1)
        .single();
      
      agenteData = primeiroAgente;
    }

    console.log('🤖 Dados do agente encontrado:', agenteData);

    // Preparar payload do webhook
    const webhookPayload = {
      telefone_lead: telefone_lead,
      status: status,
      telefone_pri: agenteData?.telefone || '',
      dealer_id: agenteData?.dealer_id || '',
      evento: evento || 'status_change',
      timestamp: new Date().toISOString()
    };

    console.log('📤 Enviando payload para webhook:', webhookPayload);

    // Disparar webhook
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await webhookResponse.text();
    console.log('📥 Resposta do webhook:', webhookResponse.status, responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: webhookResponse.ok,
        status: webhookResponse.status,
        data: responseData,
        payload_sent: webhookPayload
      }),
      {
        status: webhookResponse.ok ? 200 : webhookResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro no atendimento-status-webhook:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS
const allowedOrigins = [
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Testing webhook call with Fabricio data...');
    
    // Test data provided by user
    const testData = {
      gatilho: 'novo_contato_prospeccao',
      dados: {
        prospeccao_id: 'test-prospeccao-id',
        contato_id: '1234',
        nome: 'Fabricio',
        telefone: '62992390133',
        email: 'fabricio@teste.com',
        status: 'Novo'
      }
    };

    console.log('Calling trigger-webhook with test data:', testData);

    // Call the trigger-webhook function with test data
    const { data: webhookResult, error: webhookError } = await supabaseClient.functions.invoke('trigger-webhook', {
      body: testData
    });

    console.log('Webhook response:', webhookResult);
    console.log('Webhook error:', webhookError);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teste de webhook executado com sucesso',
        test_data: testData,
        webhook_result: webhookResult,
        webhook_error: webhookError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro no teste do webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
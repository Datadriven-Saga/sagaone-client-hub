import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS
const allowedOrigins = [
  'https://automatemaia.sagadatadriven.com.br',
  'https://lovable.dev',
  'https://id-preview--c4cc9f7d-5d60-4beb-ad66-04c36f0ace7c.lovable.app',
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
    
    console.log(`API prospeccao-anotacao accessed by user: ${userEmail} (${userId})`);
    console.log(`Request data:`, { prospeccao_id: req.url.includes('prospeccao_id') });

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { prospeccao_id, contato_id, mensagem } = await req.json();

    if (!prospeccao_id || !contato_id || !mensagem) {
      return new Response(
        JSON.stringify({ 
          error: 'prospeccao_id, contato_id e mensagem são obrigatórios' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verificar se o contato existe
    const { data: contato, error: contatoError } = await supabaseClient
      .from('contatos')
      .select('id, nome')
      .eq('id', contato_id)
      .single();

    if (contatoError || !contato) {
      return new Response(
        JSON.stringify({ error: 'Contato não encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Inserir evento de prospecção (anotação) - salvar userId em observacoes para referência
    const { data: evento, error: eventoError } = await supabaseClient
      .from('eventos_prospeccao')
      .insert({
        prospeccao_id: prospeccao_id,
        contato_id: contato_id,
        tipo_evento: 'Anotação',
        descricao: mensagem,
        observacoes: userId || null,
        data_evento: new Date().toISOString()
      })
      .select()
      .single();

    if (eventoError) {
      console.error('Erro ao inserir anotação:', eventoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao inserir anotação' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Disparar gatilho de adição de anotação
    await supabaseClient.functions.invoke('trigger-webhook', {
      body: {
        gatilho: 'adicao_anotacao_prospeccao',
        dados: {
          prospeccao_id: prospeccao_id,
          contato_id: contato_id,
          mensagem: mensagem,
          evento_id: evento.id
        }
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        evento_id: evento.id,
        prospeccao_id: prospeccao_id,
        contato_id: contato_id,
        mensagem: mensagem,
        data_criacao: evento.created_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na API prospeccao-anotacao:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
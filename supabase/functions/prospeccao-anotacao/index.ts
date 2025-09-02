import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Inserir evento de prospecção (anotação)
    const { data: evento, error: eventoError } = await supabaseClient
      .from('eventos_prospeccao')
      .insert({
        prospeccao_id: prospeccao_id,
        contato_id: contato_id,
        tipo_evento: 'Anotação',
        descricao: mensagem,
        observacoes: 'Adicionado via API',
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://automatemaia.sagadatadriven.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    
    console.log(`API prospeccao-status accessed by user: ${userEmail} (${userId})`);
    console.log(`Request method: ${req.method}, URL: ${req.url}`);

    const url = new URL(req.url);
    const prospeccaoId = url.searchParams.get('prospeccao_id');
    const contatoId = url.searchParams.get('contato_id');

    if (!prospeccaoId || !contatoId) {
      return new Response(
        JSON.stringify({ 
          error: 'prospeccao_id e contato_id são obrigatórios' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'GET') {
      // Consultar status do contato
      const { data: contato, error } = await supabaseClient
        .from('contatos')
        .select('id, nome, telefone, email, status')
        .eq('id', contatoId)
        .single();

      if (error) {
        console.error('Erro ao buscar contato:', error);
        return new Response(
          JSON.stringify({ error: 'Contato não encontrado' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          prospeccao_id: prospeccaoId,
          contato_id: contatoId,
          status: contato.status,
          nome: contato.nome,
          telefone: contato.telefone,
          email: contato.email
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      // Alterar status do contato
      const { novo_status } = await req.json();

      if (!novo_status) {
        return new Response(
          JSON.stringify({ error: 'novo_status é obrigatório' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Primeiro, buscar o status anterior
      const { data: contatoAnterior } = await supabaseClient
        .from('contatos')
        .select('status')
        .eq('id', contatoId)
        .single();

      // Atualizar status
      const { error: updateError } = await supabaseClient
        .from('contatos')
        .update({ 
          status: novo_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', contatoId);

      if (updateError) {
        console.error('Erro ao atualizar contato:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar status' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Registrar log de movimentação
      await supabaseClient
        .from('logs_movimentacao_contatos')
        .insert({
          contato_id: contatoId,
          prospeccao_id: prospeccaoId,
          status_anterior: contatoAnterior?.status,
          status_novo: novo_status,
          observacoes: 'Alteração via API'
        });

      // Disparar gatilho de alteração de status
      await supabaseClient.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'alteracao_status_contato',
          dados: {
            prospeccao_id: prospeccaoId,
            contato_id: contatoId,
            status_anterior: contatoAnterior?.status,
            status_novo: novo_status
          }
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          prospeccao_id: prospeccaoId,
          contato_id: contatoId,
          status_anterior: contatoAnterior?.status,
          status_novo: novo_status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na API prospeccao-status:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
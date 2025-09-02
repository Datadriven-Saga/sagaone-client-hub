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

    const url = new URL(req.url);
    const prospeccaoId = url.searchParams.get('prospeccao_id');
    const leadId = url.searchParams.get('lead_id');

    if (!prospeccaoId || !leadId) {
      return new Response(
        JSON.stringify({ 
          error: 'prospeccao_id e lead_id são obrigatórios' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'GET') {
      // Consultar status do contato
      const { data: lead, error } = await supabaseClient
        .from('leads')
        .select('id, nome, telefone, email, status')
        .eq('id', leadId)
        .single();

      if (error) {
        console.error('Erro ao buscar lead:', error);
        return new Response(
          JSON.stringify({ error: 'Lead não encontrado' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          prospeccao_id: prospeccaoId,
          lead_id: leadId,
          status: lead.status,
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email
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
      const { data: leadAnterior } = await supabaseClient
        .from('leads')
        .select('status')
        .eq('id', leadId)
        .single();

      // Atualizar status
      const { error: updateError } = await supabaseClient
        .from('leads')
        .update({ 
          status: novo_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('Erro ao atualizar lead:', updateError);
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
        .from('logs_movimentacao_leads')
        .insert({
          lead_id: leadId,
          prospeccao_id: prospeccaoId,
          status_anterior: leadAnterior?.status,
          status_novo: novo_status,
          observacoes: 'Alteração via API'
        });

      // Disparar gatilho de alteração de status
      await supabaseClient.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'alteracao_status_contato',
          dados: {
            prospeccao_id: prospeccaoId,
            lead_id: leadId,
            status_anterior: leadAnterior?.status,
            status_novo: novo_status
          }
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          prospeccao_id: prospeccaoId,
          lead_id: leadId,
          status_anterior: leadAnterior?.status,
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
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
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, OPTIONS',
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
    
    console.log(`API prospeccao-status accessed by user: ${userEmail} (${userId})`);
    console.log(`Request method: ${req.method}, URL: ${req.url}`);

    const url = new URL(req.url);
    const leadIdParam = url.searchParams.get('lead_id');

    if (!leadIdParam) {
      return new Response(
        JSON.stringify({ 
          error: 'lead_id é obrigatório',
          exemplo: '/prospeccao-status?lead_id=42'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determinar se é lead_id numérico ou contato_id UUID (retrocompatibilidade)
    const isNumericLeadId = /^\d+$/.test(leadIdParam);
    
    console.log(`   ├─ lead_id: ${leadIdParam}`);
    console.log(`   └─ tipo: ${isNumericLeadId ? 'numérico (lead_id)' : 'UUID (contato_id)'}`);

    // Buscar contato pelo identificador apropriado
    let contato;
    let contatoError;

    if (isNumericLeadId) {
      // Buscar por lead_id (INTEGER)
      const result = await supabaseClient
        .from('contatos')
        .select('id, lead_id, nome, telefone, email, status, empresa_id')
        .eq('lead_id', parseInt(leadIdParam))
        .single();
      contato = result.data;
      contatoError = result.error;
    } else {
      // Buscar por id (UUID) - retrocompatibilidade
      const result = await supabaseClient
        .from('contatos')
        .select('id, lead_id, nome, telefone, email, status, empresa_id')
        .eq('id', leadIdParam)
        .single();
      contato = result.data;
      contatoError = result.error;
    }

    if (contatoError || !contato) {
      console.error('Contato não encontrado:', contatoError);
      return new Response(
        JSON.stringify({ 
          error: 'Contato não encontrado',
          lead_id: leadIdParam,
          tipo_busca: isNumericLeadId ? 'lead_id numérico' : 'contato_id UUID'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar prospeccao_id associada ao contato (via eventos_prospeccao)
    const { data: eventoProspeccao } = await supabaseClient
      .from('eventos_prospeccao')
      .select('prospeccao_id')
      .eq('contato_id', contato.id)
      .limit(1)
      .single();
    
    const prospeccaoId = eventoProspeccao?.prospeccao_id || null;

    if (req.method === 'GET') {
      // Consultar status do contato
      console.log(`   ├─ Contato encontrado: ${contato.nome}`);
      console.log(`   └─ Status atual: ${contato.status}`);

      return new Response(
        JSON.stringify({
          lead_id: contato.lead_id,
          contato_id: contato.id,
          prospeccao_id: prospeccaoId,
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
          JSON.stringify({ error: 'novo_status é obrigatório no body da requisição' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const statusAnterior = contato.status;

      // Atualizar status
      const { error: updateError } = await supabaseClient
        .from('contatos')
        .update({ 
          status: novo_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', contato.id);

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

      console.log(`   ├─ Status anterior: ${statusAnterior}`);
      console.log(`   └─ Novo status: ${novo_status}`);

      // Registrar log de movimentação (se tiver prospeccao_id)
      if (prospeccaoId) {
        await supabaseClient
          .from('logs_movimentacao_contatos')
          .insert({
            contato_id: contato.id,
            prospeccao_id: prospeccaoId,
            status_anterior: statusAnterior,
            status_novo: novo_status,
            usuario_id: userId || null,
            observacoes: 'Alteração via API (lead_id)'
          });

        // Disparar gatilho de alteração de status
        await supabaseClient.functions.invoke('trigger-webhook', {
          body: {
            gatilho: 'alteracao_status_contato',
            dados: {
              lead_id: contato.lead_id,
              prospeccao_id: prospeccaoId,
              contato_id: contato.id,
              status_anterior: statusAnterior,
              status_novo: novo_status
            }
          }
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          lead_id: contato.lead_id,
          contato_id: contato.id,
          prospeccao_id: prospeccaoId,
          status_anterior: statusAnterior,
          status_novo: novo_status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use GET ou PUT.' }),
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

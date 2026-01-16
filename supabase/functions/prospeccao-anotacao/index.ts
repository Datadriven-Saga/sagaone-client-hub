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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json();
    const { lead_id, mensagem } = body;

    console.log(`Request body:`, { lead_id, mensagem: mensagem?.substring(0, 50) });

    if (!lead_id || !mensagem) {
      return new Response(
        JSON.stringify({ 
          error: 'lead_id e mensagem são obrigatórios',
          exemplo: '{ "lead_id": 42, "mensagem": "Texto da anotação" }'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determinar se é lead_id numérico ou contato_id UUID (retrocompatibilidade)
    const isNumericLeadId = /^\d+$/.test(String(lead_id));
    
    console.log(`   ├─ lead_id: ${lead_id}`);
    console.log(`   └─ tipo: ${isNumericLeadId ? 'numérico (lead_id)' : 'UUID (contato_id)'}`);

    // Buscar contato pelo identificador apropriado
    let contato;
    let contatoError;

    if (isNumericLeadId) {
      // Buscar por lead_id (INTEGER)
      const result = await supabaseClient
        .from('contatos')
        .select('id, lead_id, nome')
        .eq('lead_id', parseInt(String(lead_id)))
        .single();
      contato = result.data;
      contatoError = result.error;
    } else {
      // Buscar por id (UUID) - retrocompatibilidade
      const result = await supabaseClient
        .from('contatos')
        .select('id, lead_id, nome')
        .eq('id', lead_id)
        .single();
      contato = result.data;
      contatoError = result.error;
    }

    if (contatoError || !contato) {
      console.error('Contato não encontrado:', contatoError);
      return new Response(
        JSON.stringify({ 
          error: 'Contato não encontrado',
          lead_id: lead_id,
          tipo_busca: isNumericLeadId ? 'lead_id numérico' : 'contato_id UUID'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`   └─ Contato encontrado: ${contato.nome} (id: ${contato.id})`);

    // Buscar prospeccao_id associada ao contato (via eventos_prospeccao)
    const { data: eventoProspeccao } = await supabaseClient
      .from('eventos_prospeccao')
      .select('prospeccao_id')
      .eq('contato_id', contato.id)
      .limit(1)
      .single();
    
    const prospeccaoId = eventoProspeccao?.prospeccao_id || null;

    // Inserir evento de prospecção (anotação)
    const { data: evento, error: eventoError } = await supabaseClient
      .from('eventos_prospeccao')
      .insert({
        prospeccao_id: prospeccaoId,
        contato_id: contato.id,
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

    console.log(`   └─ Anotação criada com sucesso (evento_id: ${evento.id})`);

    // Disparar gatilho de adição de anotação (se tiver prospeccao_id)
    if (prospeccaoId) {
      await supabaseClient.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'adicao_anotacao_prospeccao',
          dados: {
            lead_id: contato.lead_id,
            prospeccao_id: prospeccaoId,
            contato_id: contato.id,
            mensagem: mensagem,
            evento_id: evento.id
          }
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        evento_id: evento.id,
        lead_id: contato.lead_id,
        contato_id: contato.id,
        prospeccao_id: prospeccaoId,
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

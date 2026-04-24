import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decodificar o payload do JWT (segunda parte do token)
    let userId: string;
    let userEmail: string;
    try {
      const payloadBase64Url = token.split('.')[1];
      // Convert base64url to standard base64
      const payloadBase64 = payloadBase64Url
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(payloadBase64Url.length + (4 - payloadBase64Url.length % 4) % 4, '=');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      
      userId = payload.sub;
      userEmail = payload.email;
      
      if (!userId) {
        throw new Error('Token sem sub');
      }
      
      // Verificar se o token não expirou
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expirado');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Erro ao decodificar JWT:', message);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`API prospeccao-anotacao accessed by user: ${userEmail} (${userId})`);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const lead_id = body.lead_id || body.contato_id;
    const mensagem = body.mensagem;
    const prospeccao_id_override = body.prospeccao_id || null;

    console.log(`Request body:`, { lead_id, mensagem: mensagem?.substring(0, 50) });

    if (!lead_id || !mensagem) {
      return new Response(
        JSON.stringify({ 
          error: 'lead_id (ou contato_id) e mensagem são obrigatórios',
          exemplo: '{ "lead_id": 42, "mensagem": "Texto da anotação" }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isNumericLeadId = /^\d+$/.test(String(lead_id));
    
    console.log(`   ├─ lead_id: ${lead_id}`);
    console.log(`   └─ tipo: ${isNumericLeadId ? 'numérico (lead_id)' : 'UUID (contato_id)'}`);

    // Use service role client for DB operations to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let contato;
    let contatoError;

    if (isNumericLeadId) {
      const result = await supabaseAdmin
        .from('contatos')
        .select('id, lead_id, nome')
        .eq('lead_id', parseInt(String(lead_id)))
        .single();
      contato = result.data;
      contatoError = result.error;
    } else {
      const result = await supabaseAdmin
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`   └─ Contato encontrado: ${contato.nome} (id: ${contato.id})`);

    let prospeccaoId = prospeccao_id_override;
    
    if (!prospeccaoId) {
      const { data: eventoProspeccao } = await supabaseAdmin
        .from('eventos_prospeccao')
        .select('prospeccao_id')
        .eq('contato_id', contato.id)
        .limit(1)
        .single();
      prospeccaoId = eventoProspeccao?.prospeccao_id || null;
    }

    // Inserir evento de prospecção (anotação) com usuario_id dedicado
    const { data: evento, error: eventoError } = await supabaseAdmin
      .from('eventos_prospeccao')
      .insert({
        prospeccao_id: prospeccaoId,
        contato_id: contato.id,
        tipo_evento: 'Anotação',
        descricao: mensagem,
        usuario_id: userId,
        data_evento: new Date().toISOString()
      })
      .select()
      .single();

    if (eventoError) {
      console.error('Erro ao inserir anotação:', eventoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao inserir anotação', details: eventoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`   └─ Anotação criada com sucesso (evento_id: ${evento.id}, user_id: ${userId})`);

    // Disparar gatilho de adição de anotação (se tiver prospeccao_id)
    if (prospeccaoId) {
      await supabaseAdmin.functions.invoke('trigger-webhook', {
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
        user_id: userId,
        data_criacao: evento.created_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na API prospeccao-anotacao:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

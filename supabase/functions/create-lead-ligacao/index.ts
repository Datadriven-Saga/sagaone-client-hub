import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_TOKEN = Deno.env.get('SAGA_ONE_ADMIN_TOKEN') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // --- Autenticação via Admin Token ---
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou ausente', uso: 'Header Authorization: Bearer <SAGA_ONE_ADMIN_TOKEN>' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // --- Parsear body ---
    const body = await req.json();
    const { nome, telefone, origem, observacao, id_evento, pri_telefone } = body;

    // Validações
    if (!nome || !nome.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campo "nome" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!telefone || !telefone.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campo "telefone" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!id_evento || isNaN(Number(id_evento))) {
      return new Response(
        JSON.stringify({ error: 'Campo "id_evento" é obrigatório e deve ser numérico (ex: 27)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar evento de ligação (eventos_pri_voz) pelo id_evento numérico
    const { data: eventoPri, error: eventoError } = await supabaseClient
      .from('eventos_pri_voz')
      .select('id, id_evento, empresa_id, nome')
      .eq('id_evento', Number(id_evento))
      .maybeSingle();

    if (eventoError || !eventoPri) {
      console.error('❌ Evento de ligação não encontrado:', id_evento, eventoError);
      return new Response(
        JSON.stringify({ error: 'Evento de ligação não encontrado para o id_evento informado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const empresa_id = eventoPri.empresa_id;
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Verificar duplicidade por telefone na mesma empresa
    const { data: existente } = await supabaseClient
      .from('contatos')
      .select('id, lead_id, nome, status')
      .eq('empresa_id', empresa_id)
      .eq('telefone', telefoneNormalizado)
      .maybeSingle();

    if (existente) {
      console.log(`⚠️ Lead duplicado: ${existente.nome} (lead_id: ${existente.lead_id}) — evento_pri: ${eventoPri.id_evento}`);

      return new Response(
        JSON.stringify({
          success: true,
          duplicado: true,
          lead_id: existente.lead_id,
          contato_id: existente.id,
          nome: existente.nome,
          status: existente.status,
          id_evento: eventoPri.id_evento,
          message: 'Lead já existia nesta empresa',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar o contato
    const { data: novoContato, error: insertError } = await supabaseClient
      .from('contatos')
      .insert({
        nome: nome.trim(),
        telefone: telefoneNormalizado,
        empresa_id,
        origem: origem === 'Ligação' ? 'ligacao' : (origem || 'ligacao'),
        observacoes: observacao?.trim() || null,
        status: 'Novo',
      })
      .select('id, lead_id, nome, telefone, status, empresa_id, origem, created_at')
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar lead', detalhes: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Lead criado via ligação: ${novoContato.nome} (lead_id: ${novoContato.lead_id}) → evento_pri: ${eventoPri.nome} (${eventoPri.id_evento})`);

    // Disparar gatilho
    try {
      await supabaseClient.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'criacao_lead',
          dados: {
            lead_id: novoContato.lead_id,
            contato_id: novoContato.id,
            nome: novoContato.nome,
            telefone: novoContato.telefone,
            status: novoContato.status,
            empresa_id: novoContato.empresa_id,
            origem: novoContato.origem,
            id_evento: eventoPri.id_evento,
            pri_telefone: pri_telefone || null,
          }
        }
      });
    } catch (triggerErr) {
      console.error('⚠️ Erro ao disparar gatilho:', triggerErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        duplicado: false,
        lead_id: novoContato.lead_id,
        contato_id: novoContato.id,
        nome: novoContato.nome,
        telefone: novoContato.telefone,
        status: novoContato.status,
        empresa_id: novoContato.empresa_id,
        origem: novoContato.origem,
        pri_telefone: pri_telefone || null,
        id_evento: eventoPri.id_evento,
        evento: eventoPri.nome,
        created_at: novoContato.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API create-lead-ligacao:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

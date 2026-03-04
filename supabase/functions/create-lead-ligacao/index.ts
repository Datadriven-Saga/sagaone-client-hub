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
    const { nome, telefone, origem, observacao, id_evento } = body;

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

    if (!id_evento) {
      return new Response(
        JSON.stringify({ error: 'Campo "id_evento" é obrigatório (UUID da prospecção de ligação)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar prospecção (evento de ligação) para obter empresa_id
    const { data: prospeccao, error: prospError } = await supabaseClient
      .from('prospeccoes')
      .select('id, empresa_id, titulo')
      .eq('id', id_evento)
      .maybeSingle();

    if (prospError || !prospeccao) {
      console.error('❌ Evento de ligação não encontrado:', id_evento, prospError);
      return new Response(
        JSON.stringify({ error: 'Evento de ligação não encontrado para o id_evento informado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const empresa_id = prospeccao.empresa_id;
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Verificar duplicidade por telefone na mesma empresa
    const { data: existente } = await supabaseClient
      .from('contatos')
      .select('id, lead_id, nome, status')
      .eq('empresa_id', empresa_id)
      .eq('telefone', telefoneNormalizado)
      .maybeSingle();

    if (existente) {
      // Lead já existe — vincular ao evento se ainda não vinculado
      const { error: vinculoError } = await supabaseClient
        .from('eventos_prospeccao')
        .insert({ contato_id: existente.id, prospeccao_id: id_evento })
        .select()
        .maybeSingle();

      const jaVinculado = vinculoError?.code === '23505'; // unique violation

      console.log(`⚠️ Lead duplicado: ${existente.nome} (lead_id: ${existente.lead_id}) — vínculo: ${jaVinculado ? 'já existia' : 'criado'}`);

      return new Response(
        JSON.stringify({
          success: true,
          duplicado: true,
          vinculado: !jaVinculado,
          lead_id: existente.lead_id,
          contato_id: existente.id,
          nome: existente.nome,
          status: existente.status,
          message: jaVinculado
            ? 'Lead já existia e já estava vinculado ao evento'
            : 'Lead já existia e foi vinculado ao evento de ligação',
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
        origem: origem || 'Telefone',
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

    // Vincular ao evento de ligação
    const { error: vinculoError } = await supabaseClient
      .from('eventos_prospeccao')
      .insert({ contato_id: novoContato.id, prospeccao_id: id_evento });

    if (vinculoError) {
      console.error('⚠️ Lead criado mas erro ao vincular ao evento:', vinculoError);
    }

    console.log(`✅ Lead criado via ligação: ${novoContato.nome} (lead_id: ${novoContato.lead_id}) → evento: ${prospeccao.titulo}`);

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
            id_evento,
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
        evento: prospeccao.titulo,
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

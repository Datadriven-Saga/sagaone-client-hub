import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = [
  'https://automatemaia.sagadatadriven.com.br',
  'https://automatemaiawh.sagadatadriven.com.br',
  'https://one.sagadatadriven.com.br',
  'https://sagaone-client-hub.lovable.app',
  'https://lovable.dev',
  'https://7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovableproject.com',
  'https://id-preview--7bc578c3-4b3d-4f33-830e-6157c828c9e5.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '')) || origin === allowed);
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

const ADMIN_TOKEN = Deno.env.get('SAGA_ONE_ADMIN_TOKEN') ?? '';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use GET.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // --- Autenticação ---
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isAdminToken = token && ADMIN_TOKEN && token === ADMIN_TOKEN;

    let supabaseClient;

    if (isAdminToken) {
      console.log('🔐 search-lead: Admin Token');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
    } else if (token) {
      console.log('🔐 search-lead: JWT');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          auth: { persistSession: false },
          global: { headers: authHeader ? { authorization: authHeader } : {} },
        }
      );
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido ou expirado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Parâmetros ---
    const url = new URL(req.url);
    const telefoneParam = url.searchParams.get('telefone');
    const empresaIdParam = url.searchParams.get('empresa_id');

    if (!telefoneParam) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "telefone" é obrigatório', exemplo: '/search-lead?telefone=11999998888&empresa_id=uuid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone: só dígitos, remover DDI 55 se > 11 dígitos
    let telefoneNorm = telefoneParam.replace(/\D/g, '');
    if (telefoneNorm.length > 11 && telefoneNorm.startsWith('55')) {
      telefoneNorm = telefoneNorm.substring(2);
    }

    console.log(`🔍 Buscando lead por telefone: ${telefoneNorm}${empresaIdParam ? ` | empresa: ${empresaIdParam}` : ''}`);

    // --- Buscar contato ---
    let query = supabaseClient
      .from('contatos')
      .select('id, lead_id, nome, telefone, email, status, empresa_id, origem, responsavel_email, created_at');

    if (empresaIdParam) {
      query = query.eq('empresa_id', empresaIdParam);
    }

    const { data: contatos, error: contatoError } = await query;

    if (contatoError) {
      console.error('Erro ao buscar contatos:', contatoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar contatos', detalhes: contatoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar por match flexível de telefone
    const contatoEncontrado = contatos?.find(c => {
      const ct = (c.telefone || '').replace(/\D/g, '');
      return ct === telefoneNorm || ct.endsWith(telefoneNorm) || telefoneNorm.endsWith(ct);
    });

    if (!contatoEncontrado) {
      return new Response(
        JSON.stringify({ encontrado: false, telefone_buscado: telefoneNorm, mensagem: 'Nenhum lead encontrado com este telefone' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Buscar prospecções vinculadas e id_evento PRI ---
    const { data: eventosProspeccao } = await supabaseClient
      .from('eventos_prospeccao')
      .select('prospeccao_id')
      .eq('contato_id', contatoEncontrado.id);

    const prospeccaoIds = eventosProspeccao?.map(ep => ep.prospeccao_id).filter(Boolean) || [];

    // Buscar dados PRI (id_evento numérico) das prospecções vinculadas
    let priEventos: { prospeccao_id: string; id_evento: number; telefone_pri: string | null }[] = [];
    if (prospeccaoIds.length > 0) {
      // Buscar prospecções para pegar event_id_pri
      const { data: prospeccoes } = await supabaseClient
        .from('prospeccoes')
        .select('id, event_id_pri, nome')
        .in('id', prospeccaoIds);

      // Buscar eventos_pri_voz para ids numéricos
      const { data: eventosPri } = await supabaseClient
        .from('eventos_pri_voz')
        .select('id_evento, empresa_id')
        .eq('empresa_id', contatoEncontrado.empresa_id);

      // Buscar telefone_pri do agente IA "Pri" da empresa
      const { data: agentePri } = await supabaseClient
        .from('agentes_ia')
        .select('telefone')
        .eq('empresa_id', contatoEncontrado.empresa_id)
        .eq('nome', 'Pri')
        .limit(1)
        .maybeSingle();

      const telefonePri = agentePri?.telefone?.replace(/\D/g, '') || null;

      priEventos = (prospeccoes || [])
        .filter(p => p.event_id_pri)
        .map(p => ({
          prospeccao_id: p.id,
          id_evento: parseInt(p.event_id_pri, 10),
          telefone_pri: telefonePri,
        }));
    }

    console.log(`✅ Lead encontrado: ${contatoEncontrado.nome} (lead_id: ${contatoEncontrado.lead_id})`);

    return new Response(
      JSON.stringify({
        encontrado: true,
        lead_id: contatoEncontrado.lead_id,
        contato_id: contatoEncontrado.id,
        nome: contatoEncontrado.nome,
        telefone: contatoEncontrado.telefone,
        email: contatoEncontrado.email,
        status: contatoEncontrado.status,
        empresa_id: contatoEncontrado.empresa_id,
        origem: contatoEncontrado.origem,
        responsavel_email: contatoEncontrado.responsavel_email,
        created_at: contatoEncontrado.created_at,
        prospeccao_ids: prospeccaoIds,
        pri_eventos: priEventos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API search-lead:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

const ADMIN_TOKEN = Deno.env.get('SAGA_ONE_ADMIN_TOKEN') ?? '';

/**
 * Normalização canônica de telefone (mesma lógica do process-import / bulk_upsert_contatos):
 * - Remove tudo que não é dígito
 * - Remove DDI 55 quando aplicável
 * - Remove 9º dígito de celular
 * Resultado: 10 dígitos (DDD + 8).
 */
function normalizePhoneCanonical(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0055')) d = d.slice(4);
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1);
  if (d.length === 11 && d[2] === '9') {
    d = d.slice(0, 2) + d.slice(3);
  }
  if (d.length !== 10) return d; // devolve o que tem; check de dup ainda usa esse valor
  return d;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
    // --- Autenticação (mesmo padrão do prospeccao-status) ---
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isAdminToken = token && ADMIN_TOKEN && token === ADMIN_TOKEN;

    let supabaseClient;
    let userId: string | undefined;

    if (isAdminToken) {
      console.log('🔐 create-lead: Autenticação via Admin Token');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      userId = 'admin-api';
    } else if (token) {
      console.log('🔐 create-lead: Autenticação via JWT');
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
      userId = userData.user.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária', uso: 'Header Authorization: Bearer <token>' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Parsear body ---
    const body = await req.json();
    const { nome, telefone, email, empresa_id, origem, observacoes, responsavel_email, status, prospeccao_id } = body;

    // Validações obrigatórias
    if (!nome || !nome.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campo "nome" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: 'Campo "empresa_id" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Validações server-side (pular se for admin token) ---
    if (!isAdminToken && userId) {
      // 1. Empresa: usuário precisa ter acesso
      const { data: acesso } = await supabaseClient
        .from('user_empresas')
        .select('id')
        .eq('user_id', userId)
        .eq('empresa_id', empresa_id)
        .limit(1)
        .maybeSingle();

      if (!acesso) {
        return new Response(
          JSON.stringify({ error: 'Sem acesso a esta empresa', code: 'FORBIDDEN' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (prospeccao_id) {
      // 2. Prospecção: precisa existir e pertencer à mesma empresa
      const { data: prosp } = await supabaseClient
        .from('prospeccoes')
        .select('id, empresa_id, ativo, encerrado_at')
        .eq('id', prospeccao_id)
        .maybeSingle();

      if (!prosp || prosp.empresa_id !== empresa_id) {
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado nesta empresa', code: 'INVALID_PROSPECCAO' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Equipe: usuário precisa pertencer à equipe (exceto admin token)
      if (!isAdminToken && userId) {
        const { data: membros } = await supabaseClient
          .from('prospeccao_equipe_membros')
          .select('id, equipe_id, prospeccao_equipes!inner(prospeccao_id)')
          .eq('user_id', userId)
          .eq('prospeccao_equipes.prospeccao_id', prospeccao_id)
          .limit(1);

        if (!membros || membros.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Você não pertence à equipe deste evento', code: 'NOT_IN_TEAM' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Normalizar telefone (remover não-dígitos)
    const telefoneNormalizado = normalizePhoneCanonical(telefone);

    // Verificar duplicidade por telefone na mesma empresa (se telefone fornecido)
    if (telefoneNormalizado) {
      const { data: existente } = await supabaseClient
        .from('contatos')
        .select('id, lead_id, nome, status, responsavel_email')
        .eq('empresa_id', empresa_id)
        .eq('telefone', telefoneNormalizado)
        .limit(1)
        .maybeSingle();

      if (existente) {
        console.log(`⚠️ Lead duplicado encontrado: ${existente.nome} (lead_id: ${existente.lead_id})`);

        // Buscar evento (prospecção) mais recente do contato para contextualizar o 409
        let evento_ativo: {
          prospeccao_id: string;
          prospeccao_titulo: string | null;
          encerrada: boolean;
        } | null = null;

        const { data: evento } = await supabaseClient
          .from('eventos_prospeccao')
          .select('prospeccao_id, prospeccoes:prospeccao_id(id, titulo, encerrado_at, ativo)')
          .eq('contato_id', existente.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (evento?.prospeccoes) {
          const p = evento.prospeccoes as { id: string; titulo: string | null; encerrado_at: string | null; ativo: boolean | null };
          evento_ativo = {
            prospeccao_id: p.id,
            prospeccao_titulo: p.titulo,
            encerrada: p.encerrado_at !== null || p.ativo === false,
          };
        }

        return new Response(
          JSON.stringify({
            error: 'Lead já existe com este telefone',
            lead_existente: {
              lead_id: existente.lead_id,
              contato_id: existente.id,
              nome: existente.nome,
              status: existente.status,
              responsavel_email: existente.responsavel_email,
              evento_ativo,
            }
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mapear status recebido para enum válido
    const statusMap: Record<string, string> = {
      'novo': 'Novo',
      'atribuido': 'Atribuído',
      'em_espera': 'Em Espera',
      'convidado': 'Convidado',
      'agendado': 'Agendado',
      'confirmado': 'Confirmado',
      'checkin': 'Check-in',
      'check-in': 'Check-in',
      'venda': 'Venda',
      'descartado': 'Descartado',
      'opt_out': 'Opt Out',
      'negociacao': 'Negociação',
      'em_contato': 'Em Contato',
      'qualificado': 'Qualificado',
      'fechado': 'Fechado',
      'perdido': 'Perdido',
      'proposta': 'Proposta',
    };

    const statusFinal = status
      ? (statusMap[status.toLowerCase()] || status)
      : 'Novo';

    // Criar contato + vínculo de forma atômica via RPC (evita lead órfão)
    const { data: atomicResult, error: atomicError } = await supabaseClient.rpc('create_lead_atomic', {
      p_empresa_id: empresa_id,
      p_nome: nome.trim(),
      p_telefone: telefoneNormalizado,
      p_email: email?.trim() || null,
      p_responsavel_email: responsavel_email || null,
      p_status: statusFinal,
      p_origem: origem || 'Outros',
      p_observacoes: observacoes?.trim() || null,
      p_prospeccao_id: prospeccao_id || null,
    });

    if (atomicError || !atomicResult) {
      console.error('❌ Erro ao criar lead (RPC atômica):', atomicError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar lead', detalhes: atomicError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const novoContato = {
      id: (atomicResult as any).contato_id as string,
      lead_id: (atomicResult as any).lead_id as number,
      nome: nome.trim(),
      telefone: telefoneNormalizado,
      email: email?.trim() || null,
      status: statusFinal,
      empresa_id,
      origem: origem || 'Outros',
      responsavel_email: responsavel_email || null,
      created_at: new Date().toISOString(),
    };

    console.log(`✅ Lead criado: ${novoContato.nome} (lead_id: ${novoContato.lead_id}, id: ${novoContato.id})`);
    if ((atomicResult as any).evento_prospeccao_id) {
      console.log(`   └─ Vinculado à prospecção: ${prospeccao_id}`);
    }

    // Disparar gatilho de criação de lead
    try {
      await supabaseClient.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'criacao_lead',
          dados: {
            lead_id: novoContato.lead_id,
            contato_id: novoContato.id,
            nome: novoContato.nome,
            telefone: novoContato.telefone,
            email: novoContato.email,
            status: novoContato.status,
            empresa_id: novoContato.empresa_id,
          }
        }
      });
    } catch (triggerErr) {
      console.error('⚠️ Erro ao disparar gatilho de criação:', triggerErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: novoContato.lead_id,
        contato_id: novoContato.id,
        nome: novoContato.nome,
        telefone: novoContato.telefone,
        email: novoContato.email,
        status: novoContato.status,
        empresa_id: novoContato.empresa_id,
        origem: novoContato.origem,
        created_at: novoContato.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na API create-lead:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

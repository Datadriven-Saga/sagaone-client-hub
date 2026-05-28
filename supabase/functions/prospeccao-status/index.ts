import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS
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
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Token de admin para chamadas externas (ex: n8n)
const ADMIN_TOKEN = Deno.env.get('SAGA_ONE_ADMIN_TOKEN') ?? '';
const PRI_IA_USER_ID = Deno.env.get('PRI_IA_USER_ID');
const PRI_IA_EMAIL = 'pri.ia@sagadatadriven.com.br';

// PR 0: timeout para webhook externo (síncrono, mas não infinito)
const WEBHOOK_TIMEOUT_MS = 15000;

type WebhookKind = 'criacao_lead' | 'atualizacao_status' | null;
type WebhookStatus = 'ok' | 'skipped' | 'failed' | 'timeout' | 'not_invoked';

/**
 * PR 0: chama trigger-webhook com AbortController e timeout, sem nunca lançar.
 * Retorna o payload bruto da edge interna para extração opcional de codigo_proposta.
 */
async function invokeWebhookWithTimeout(
  body: unknown,
  timeoutMs: number,
): Promise<{ status: WebhookStatus; error?: string; payload?: any }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: 'failed', error: 'SUPABASE_URL/SERVICE_ROLE não configurados' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/trigger-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      return { status: 'failed', error: `HTTP ${res.status}`, payload };
    }
    return { status: 'ok', payload };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { status: 'timeout', error: `timeout após ${timeoutMs}ms` };
    }
    return { status: 'failed', error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tenta extrair codigo_proposta de qualquer formato razoável do payload do webhook.
 */
function extractCodigoProposta(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.codigo_proposta,
    payload.codigoProposta,
    payload?.data?.codigo_proposta,
    payload?.response?.codigo_proposta,
    payload?.dados?.codigo_proposta,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number') return String(c);
  }
  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação - JWT do usuário OU token de admin
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Verificar se é o token de admin (antes de tentar validar como JWT)
    const isAdminToken = token && ADMIN_TOKEN && token === ADMIN_TOKEN;
    
    if (isAdminToken && !PRI_IA_USER_ID) {
      console.error('PRI_IA_USER_ID não configurado');
      return new Response(
        JSON.stringify({ error: 'Configuração de sistema ausente (PRI_IA_USER_ID)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    let supabaseClient;
    let userId: string | undefined;
    let userEmail: string | undefined;
    
    if (isAdminToken) {
      // Usar service role para acesso admin (bypassa RLS)
      console.log('🔐 Autenticação via Admin Token (acesso admin)');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      userId = 'admin-api';
      userEmail = 'admin-api@sagaone.system';
    } else if (token) {
      // Tentar validar como JWT do usuário (respeita RLS)
      console.log('🔐 Autenticação via JWT de usuário');
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData?.user) {
        console.warn('❌ prospeccao-status: token inválido/expirado', userError?.message);
        return new Response(
          JSON.stringify({
            error: 'Token inválido ou expirado',
            dica: 'Use Authorization: Bearer <jwt_token> ou Bearer <admin_token>',
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          auth: { persistSession: false },
          global: {
            headers: authHeader ? { Authorization: authHeader } : {},
          },
        }
      );

      userId = userData.user.id;
      userEmail = userData.user.email ?? undefined;
    } else {
      // Sem autenticação válida
      console.log('❌ Sem autenticação válida');
      return new Response(
        JSON.stringify({ 
          error: 'Autenticação necessária',
          uso: 'Header Authorization: Bearer <token>'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`API prospeccao-status accessed by: ${userEmail} (${userId})`);
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

    // Mapeamento de snake_case para valores do enum status_lead
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
      'optout': 'Opt Out',
      'desperdicio': 'Desperdício',
      'negociacao': 'Negociação',
      'em_contato': 'Em Contato',
      'qualificado': 'Qualificado',
      'fechado': 'Fechado',
      'perdido': 'Perdido',
      'proposta': 'Proposta',
    };

    if (req.method === 'PUT' || req.method === 'PATCH') {
      // Alterar status do contato
      const body = await req.json().catch(() => ({}));
      const {
        novo_status,
        prospeccao_id: bodyProspeccaoId,
        observacoes: bodyObservacoes,
        skip_webhooks: bodySkipWebhooks,
        webhook_kind: bodyWebhookKind,
      } = body ?? {};

      const skipWebhooks: boolean = bodySkipWebhooks === true;
      const webhookKind: WebhookKind =
        bodyWebhookKind === 'criacao_lead' || bodyWebhookKind === 'atualizacao_status'
          ? bodyWebhookKind
          : null;

      if (!novo_status) {
        return new Response(
          JSON.stringify({ error: 'novo_status é obrigatório no body da requisição' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Converter snake_case para valor do enum (ou usar diretamente se já for válido)
      const statusNormalizado = statusMap[novo_status.toLowerCase()] || novo_status;

      const statusAnterior = contato.status;

      // PR 0: prospeccao_id final — body tem prioridade sobre fallback
      const prospeccaoIdFinal: string | null =
        (typeof bodyProspeccaoId === 'string' && bodyProspeccaoId) ? bodyProspeccaoId : prospeccaoId;

      // PR 0: usuario do log
      const usuarioIdParaLog: string | null = isAdminToken
        ? (PRI_IA_USER_ID ?? null)
        : (userId && userId !== 'admin-api' ? (userId as string) : null);

      // PR 0: observação default
      const observacoesParaLog: string =
        (typeof bodyObservacoes === 'string' && bodyObservacoes.trim())
          ? bodyObservacoes.trim()
          : (isAdminToken ? 'Alteração automática via Pri IA' : 'Alteração via prospeccao-status');

      // PR 0: chamada atômica — UPDATE + INSERT no mesmo TX, com flag de sessão
      const { data: rpcRows, error: rpcError } = await supabaseClient.rpc(
        'mutate_contato_status_atomic',
        {
          p_contato: contato.id,
          p_novo: statusNormalizado,
          p_anterior: statusAnterior,
          p_prospeccao: prospeccaoIdFinal,
          p_usuario: usuarioIdParaLog,
          p_obs: observacoesParaLog,
        }
      );

      if (rpcError) {
        console.error('Erro ao mutar status (RPC):', rpcError);
        return new Response(
          JSON.stringify({
            error: 'Erro ao atualizar status',
            detalhes: rpcError.message,
            status_recebido: novo_status,
            status_normalizado: statusNormalizado,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      const updatedAt: string = rpcRow?.updated_at ?? new Date().toISOString();

      // Carimbar agente IA "pri" no lead (sem tocar em responsavel_email).
      const agentesIa: string[] = [];
      if (isAdminToken) {
        const { error: agenteError } = await supabaseClient
          .rpc('add_agente_ia', { p_contato_id: contato.id, p_agente: 'pri' });
        if (agenteError) {
          console.error('Erro ao carimbar agente_ia=pri:', agenteError.message);
        } else {
          agentesIa.push('pri');
          console.log(`   └─ agente_ia carimbado: pri`);
        }
      }

      console.log(`   ├─ Status anterior: ${statusAnterior}`);
      console.log(`   ├─ Status recebido: ${novo_status}`);
      console.log(`   └─ Status normalizado: ${statusNormalizado}`);

      // PR 0: webhooks síncronos com timeout. UPDATE+log já estão persistidos.
      let webhookStatus: WebhookStatus = 'not_invoked';
      let webhookError: string | undefined;
      let codigoProposta: string | null = null;

      if (skipWebhooks) {
        webhookStatus = 'skipped';
      } else if (prospeccaoIdFinal) {
        const principal = await invokeWebhookWithTimeout(
          {
            gatilho: 'alteracao_status_contato',
            dados: {
              lead_id: contato.lead_id,
              prospeccao_id: prospeccaoIdFinal,
              contato_id: contato.id,
              status_anterior: statusAnterior,
              status_novo: statusNormalizado,
              webhook_kind: webhookKind,
            },
          },
          WEBHOOK_TIMEOUT_MS,
        );
        webhookStatus = principal.status;
        webhookError = principal.error;

        // Se for criação de lead no externo, tenta extrair codigo_proposta e persistir
        if (principal.status === 'ok' && webhookKind === 'criacao_lead') {
          const cp = extractCodigoProposta(principal.payload);
          if (cp) {
            const { error: cpError } = await supabaseClient
              .from('contatos')
              .update({ codigo_proposta: cp })
              .eq('id', contato.id);
            if (cpError) {
              console.error('Erro ao salvar codigo_proposta:', cpError.message);
            } else {
              codigoProposta = cp;
            }
          }
        }

        // Webhook secundário (movimentação kanban) — só humanos; não afeta webhook_status principal
        if (!isAdminToken) {
          invokeWebhookWithTimeout(
            {
              gatilho: 'movimentacao_lead_kanban',
              dados: {
                contato_id: contato.id,
                empresa_id: contato.empresa_id,
                prospeccao_id: prospeccaoIdFinal,
                status_anterior: statusAnterior,
                status_novo: statusNormalizado,
                usuario_id: userId,
              },
            },
            WEBHOOK_TIMEOUT_MS,
          ).catch((e) => console.error('Webhook movimentação falhou:', e));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          lead_id: contato.lead_id,
          contato_id: contato.id,
          prospeccao_id: prospeccaoIdFinal,
          status_anterior: statusAnterior,
          status_novo: statusNormalizado,
          status_recebido: novo_status,
          updated_at: updatedAt,
          agente_ia: agentesIa,
          webhook_status: webhookStatus,
          webhook_error: webhookError ?? null,
          codigo_proposta: codigoProposta,
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

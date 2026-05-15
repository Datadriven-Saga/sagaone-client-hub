// POST /confirm-presence  body: { token: uuid }
// Endpoint público (sem JWT) que confirma presença do convidado.
// Atribui a ação ao vendedor que enviou o link (confirmation_sent_by).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { dispararMovimentacaoLeadKanban } from '../_shared/movimentacao-lead-webhook.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const token = body.token
  if (!token || !UUID_RE.test(token)) {
    return json({ error: 'Token inválido' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Token vive em eventos_prospeccao — resolve vínculo (contato + evento)
  const { data: vinculo, error: vinculoErr } = await supabase
    .from('eventos_prospeccao')
    .select('id, contato_id, prospeccao_id, confirmed_at, confirmation_expires_at, confirmation_sent_by')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (vinculoErr || !vinculo) {
    return json({ error: 'Convite não encontrado' }, 404)
  }

  const { data: contato, error: fetchError } = await supabase
    .from('contatos')
    .select('id, nome, status, qr_token, empresa_id')
    .eq('id', vinculo.contato_id)
    .maybeSingle()

  if (fetchError || !contato) {
    return json({ error: 'Convite não encontrado' }, 404)
  }

  // Feature flag por empresa: se desligada, bloquear confirmação
  if (contato.empresa_id) {
    const { data: flagEnabled } = await supabase.rpc('is_feature_enabled_for_empresa', {
      p_flag_key: 'confirmacao_presenca_whatsapp',
      p_empresa_id: contato.empresa_id,
    })
    if (!flagEnabled) {
      return json({ error: 'Convite não encontrado' }, 404)
    }
  }

  // 2. Idempotência: este vínculo já confirmou
  if (vinculo.confirmed_at) {
    return json({
      success: true,
      already_confirmed: true,
      qr_token: contato.qr_token,
      nome: contato.nome,
    })
  }

  // 3. Expiração
  if (
    vinculo.confirmation_expires_at &&
    new Date(vinculo.confirmation_expires_at as string) < new Date()
  ) {
    return json({ error: 'Link expirado' }, 410)
  }

  const prospeccaoId = vinculo.prospeccao_id ?? null
  const sentBy = vinculo.confirmation_sent_by ?? null

  // 4. Garante qr_token
  const qrToken = contato.qr_token ?? crypto.randomUUID()
  const statusAnterior = contato.status as string

  // 5. Marca o vínculo como confirmado
  const nowIso = new Date().toISOString()
  const { error: vinculoUpdErr } = await supabase
    .from('eventos_prospeccao')
    .update({ confirmed_at: nowIso })
    .eq('id', vinculo.id)

  if (vinculoUpdErr) {
    console.error('Erro ao confirmar vínculo:', vinculoUpdErr)
    return json({ error: 'Erro ao confirmar presença' }, 500)
  }

  // 5b. Atualiza status global do contato (presença confirmada em qualquer evento)
  const { error: updateError } = await supabase
    .from('contatos')
    .update({
      status: 'Confirmado',
      confirmed_at: nowIso,
      qr_token: qrToken,
      qr_token_used: false,
      updated_at: nowIso,
    })
    .eq('id', contato.id)

  if (updateError) {
    console.error('Erro ao confirmar presença:', updateError)
    return json({ error: 'Erro ao confirmar presença' }, 500)
  }

  // 6. Resolve nome do vendedor (para usuario_nome no log)
  let vendedorNome: string | null = null
  if (sentBy) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome_completo')
      .eq('id', sentBy)
      .maybeSingle()
    vendedorNome = (profile as any)?.nome_completo ?? null
  }

  // 7. Timeline (best-effort, não bloqueia resposta)
  await supabase.from('contato_timeline').insert({
    contato_id: contato.id,
    tipo: 'confirmacao_presenca',
    descricao: 'Cliente confirmou presença via link de convite',
    usuario_id: sentBy,
    usuario_nome: vendedorNome,
    metadata: { origem: 'link_confirmacao', prospeccao_id: prospeccaoId },
  })

  // 8. Log de movimentação (apenas se houver prospeccao_id — coluna NOT NULL)
  if (prospeccaoId) {
    await supabase.from('logs_movimentacao_contatos').insert({
      contato_id: contato.id,
      prospeccao_id: prospeccaoId,
      status_anterior: statusAnterior,
      status_novo: 'Confirmado',
      usuario_id: sentBy,
      observacoes: 'Confirmação automática via link público',
    })
  }

  // 9. Webhook de movimentação (best-effort, chamada in-process via helper compartilhado).
  // Evita o gateway/JWT: este endpoint é público e não tem Authorization de usuário.
  // Atribuição preservada via usuario_id = confirmation_sent_by (necessário para
  // MobiGestor e para o guard PRI_IA_USER_ID dentro do helper).
  try {
    const result = await dispararMovimentacaoLeadKanban(supabase, {
      contato_id: contato.id,
      empresa_id: contato.empresa_id,
      prospeccao_id: prospeccaoId ?? '',
      status_anterior: statusAnterior,
      status_novo: 'Confirmado',
      origem: 'link_confirmacao',
      usuario_id: sentBy,
    })
    console.log('[confirm-presence] movimentacao-lead result', {
      contato_id: contato.id,
      empresa_id: contato.empresa_id,
      prospeccao_id: prospeccaoId,
      ...result,
    })
  } catch (e) {
    console.error('[confirm-presence] movimentacao-lead exception', {
      contato_id: contato.id,
      empresa_id: contato.empresa_id,
      prospeccao_id: prospeccaoId,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  return json({
    success: true,
    already_confirmed: false,
    qr_token: qrToken,
    nome: contato.nome,
  })
})
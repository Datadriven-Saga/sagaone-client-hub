// POST /confirm-presence  body: { token: uuid }
// Endpoint público (sem JWT) que confirma presença do convidado.
// Atribui a ação ao vendedor que enviou o link (confirmation_sent_by).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

  // 1. Busca contato
  const { data: contato, error: fetchError } = await supabase
    .from('contatos')
    .select(
      'id, nome, status, confirmed_at, confirmation_expires_at, confirmation_sent_by, qr_token, empresa_id',
    )
    .eq('confirmation_token', token)
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

  // 2. Idempotência: já confirmou
  if (contato.confirmed_at) {
    return json({
      success: true,
      already_confirmed: true,
      qr_token: contato.qr_token,
      nome: contato.nome,
    })
  }

  // 3. Expiração
  if (
    contato.confirmation_expires_at &&
    new Date(contato.confirmation_expires_at) < new Date()
  ) {
    return json({ error: 'Link expirado' }, 410)
  }

  const { data: eventoContato } = await supabase
    .from('eventos_prospeccao')
    .select('prospeccao_id')
    .eq('contato_id', contato.id)
    .limit(1)
    .maybeSingle()

  const prospeccaoId = eventoContato?.prospeccao_id ?? null

  // 4. Garante qr_token
  const qrToken = contato.qr_token ?? crypto.randomUUID()
  const statusAnterior = contato.status as string

  // 5. Atualiza contato
  const { error: updateError } = await supabase
    .from('contatos')
    .update({
      status: 'Confirmado',
      confirmed_at: new Date().toISOString(),
      qr_token: qrToken,
      qr_token_used: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contato.id)

  if (updateError) {
    console.error('Erro ao confirmar presença:', updateError)
    return json({ error: 'Erro ao confirmar presença' }, 500)
  }

  // 6. Resolve nome do vendedor (para usuario_nome no log)
  let vendedorNome: string | null = null
  if (contato.confirmation_sent_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome_completo')
      .eq('id', contato.confirmation_sent_by)
      .maybeSingle()
    vendedorNome = (profile as any)?.nome_completo ?? null
  }

  // 7. Timeline (best-effort, não bloqueia resposta)
  await supabase.from('contato_timeline').insert({
    contato_id: contato.id,
    tipo: 'confirmacao_presenca',
    descricao: 'Cliente confirmou presença via link de convite',
    usuario_id: contato.confirmation_sent_by,
    usuario_nome: vendedorNome,
    metadata: { origem: 'link_confirmacao' },
  })

  // 8. Log de movimentação (apenas se houver prospeccao_id — coluna NOT NULL)
  if (prospeccaoId) {
    await supabase.from('logs_movimentacao_contatos').insert({
      contato_id: contato.id,
      prospeccao_id: prospeccaoId,
      status_anterior: statusAnterior,
      status_novo: 'Confirmado',
      usuario_id: contato.confirmation_sent_by,
      observacoes: 'Confirmação automática via link público',
    })
  }

  // 9. Webhook de movimentação (best-effort)
  try {
    await supabase.functions.invoke('trigger-webhook', {
      body: {
        gatilho: 'movimentacao_lead_kanban',
        contato_id: contato.id,
        empresa_id: contato.empresa_id,
        prospeccao_id: prospeccaoId,
        status_anterior: statusAnterior,
        status_novo: 'Confirmado',
        origem: 'link_confirmacao',
      },
    })
  } catch (e) {
    console.warn('trigger-webhook falhou (não bloqueia confirmação):', e)
  }

  return json({
    success: true,
    already_confirmed: false,
    qr_token: qrToken,
    nome: contato.nome,
  })
})
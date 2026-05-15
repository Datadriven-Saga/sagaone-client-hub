// GET /confirm-presence-info?token={uuid}
// Endpoint público (sem JWT) que retorna dados mínimos para a landing page de confirmação de presença.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token || !UUID_RE.test(token)) {
    return json({ error: 'Token inválido' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Token vive em eventos_prospeccao (vínculo contato+evento)
  const { data: vinculo, error: vinculoErr } = await supabase
    .from('eventos_prospeccao')
    .select('contato_id, prospeccao_id, confirmed_at, confirmation_expires_at')
    .eq('confirmation_token', token)
    .maybeSingle()

  if (vinculoErr || !vinculo) {
    return json({ error: 'Convite não encontrado' }, 404)
  }

  const { data: contato, error } = await supabase
    .from('contatos')
    .select('id, nome, qr_token, empresa_id')
    .eq('id', vinculo.contato_id)
    .maybeSingle()

  if (error || !contato) {
    return json({ error: 'Convite não encontrado' }, 404)
  }

  // Feature flag por empresa: se desligada, tratar como inexistente
  if (contato.empresa_id) {
    const { data: flagEnabled } = await supabase.rpc('is_feature_enabled_for_empresa', {
      p_flag_key: 'confirmacao_presenca_whatsapp',
      p_empresa_id: contato.empresa_id,
    })
    if (!flagEnabled) {
      return json({ error: 'Convite não encontrado' }, 404)
    }
  }

  // Expirado e ainda não confirmado → 410-like (mas 200 com flag pra UI poder renderizar)
  const expired =
    !vinculo.confirmed_at &&
    vinculo.confirmation_expires_at &&
    new Date(vinculo.confirmation_expires_at as string) < new Date()

  if (expired) {
    return json({ expired: true })
  }

  // Busca evento e empresa em paralelo (prospeccao_id vem direto do vínculo do token)
  const [eventoRes, empresaRes] = await Promise.all([
    vinculo.prospeccao_id
      ? supabase
          .from('prospeccoes')
          .select('titulo, data_inicio, data_fim')
          .eq('id', vinculo.prospeccao_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    contato.empresa_id
      ? supabase
          .from('empresas')
          .select('nome_empresa, endereco, cidade, uf')
          .eq('id', contato.empresa_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return json({
    nome: contato.nome,
    already_confirmed: !!vinculo.confirmed_at,
    qr_token: vinculo.confirmed_at ? contato.qr_token : null,
    evento: eventoRes.data
      ? {
          nome: (eventoRes.data as any).titulo,
          data_inicio: (eventoRes.data as any).data_inicio,
          data_fim: (eventoRes.data as any).data_fim,
        }
      : null,
    empresa: empresaRes.data
      ? {
          nome: (empresaRes.data as any).nome_empresa,
          endereco: (empresaRes.data as any).endereco,
          cidade: (empresaRes.data as any).cidade,
          uf: (empresaRes.data as any).uf,
        }
      : null,
  })
})
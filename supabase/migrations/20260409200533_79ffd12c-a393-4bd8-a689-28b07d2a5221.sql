
-- =============================================
-- 1. get_resumo_stats
-- =============================================
CREATE OR REPLACE FUNCTION public.get_resumo_stats(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid
)
RETURNS TABLE(
  status text,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.status::text,
    count(*)::bigint
  FROM contatos c
  INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
  WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
    AND c.empresa_id = p_empresa_id
  GROUP BY c.status;
$$;

-- =============================================
-- 2. get_ranking_vendedores
-- =============================================
CREATE OR REPLACE FUNCTION public.get_ranking_vendedores(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid
)
RETURNS TABLE(
  user_id uuid,
  nome_completo text,
  convidados bigint,
  checkins bigint,
  vendas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH team_members AS (
    SELECT DISTINCT em.user_id
    FROM prospeccao_equipes eq
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    WHERE eq.prospeccao_id = ANY(p_prospeccao_ids)
      AND eq.ativo = true
  ),
  member_emails AS (
    SELECT
      tm.user_id,
      p.nome_completo,
      au.email
    FROM team_members tm
    JOIN profiles p ON p.id = tm.user_id
    JOIN auth.users au ON au.id = tm.user_id
    WHERE p.tipo_acesso = 'Vendedor'
  ),
  event_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
      AND c.empresa_id = p_empresa_id
  )
  SELECT
    me.user_id,
    me.nome_completo,
    count(*) FILTER (WHERE ec.status IN ('Convidado','Confirmado','Check-in','Fechado','Venda'))::bigint AS convidados,
    count(*) FILTER (WHERE ec.status IN ('Check-in','Fechado','Venda'))::bigint AS checkins,
    count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas
  FROM member_emails me
  LEFT JOIN event_contatos ec ON (
    ec.responsavel_email = me.user_id::text
    OR ec.responsavel_email = me.email
  )
  GROUP BY me.user_id, me.nome_completo;
$$;

-- =============================================
-- 3. get_desempenho_vendedores
-- =============================================
CREATE OR REPLACE FUNCTION public.get_desempenho_vendedores(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid,
  p_date_start timestamptz DEFAULT NULL,
  p_date_end timestamptz DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  nome_completo text,
  tipo_acesso text,
  atribuidos bigint,
  convidados bigint,
  agendados bigint,
  confirmados bigint,
  checkins bigint,
  vendas bigint,
  descartes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH team_members AS (
    SELECT DISTINCT em.user_id
    FROM prospeccao_equipes eq
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    WHERE eq.prospeccao_id = ANY(p_prospeccao_ids)
      AND eq.ativo = true
  ),
  member_info AS (
    SELECT
      tm.user_id,
      p.nome_completo,
      p.tipo_acesso,
      au.email
    FROM team_members tm
    JOIN profiles p ON p.id = tm.user_id
    JOIN auth.users au ON au.id = tm.user_id
    WHERE p.tipo_acesso = 'Vendedor'
  ),
  event_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
      AND c.empresa_id = p_empresa_id
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)
  )
  SELECT
    mi.user_id,
    mi.nome_completo,
    mi.tipo_acesso,
    count(ec.id)::bigint AS atribuidos,
    count(*) FILTER (WHERE ec.status = 'Convidado')::bigint AS convidados,
    count(*) FILTER (WHERE ec.status = 'Agendado')::bigint AS agendados,
    count(*) FILTER (WHERE ec.status = 'Confirmado')::bigint AS confirmados,
    count(*) FILTER (WHERE ec.status = 'Check-in')::bigint AS checkins,
    count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas,
    count(*) FILTER (WHERE ec.status IN ('Descartado','Desperdício'))::bigint AS descartes
  FROM member_info mi
  LEFT JOIN event_contatos ec ON (
    ec.responsavel_email = mi.user_id::text
    OR ec.responsavel_email = mi.email
  )
  GROUP BY mi.user_id, mi.nome_completo, mi.tipo_acesso;
$$;

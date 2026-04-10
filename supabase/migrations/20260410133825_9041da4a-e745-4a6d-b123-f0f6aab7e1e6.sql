
-- Fix 1: get_resumo_stats - use COUNT(DISTINCT) to avoid inflated counts
CREATE OR REPLACE FUNCTION public.get_resumo_stats(p_prospeccao_ids uuid[], p_empresa_id uuid)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.status::text,
    count(DISTINCT c.id)::bigint
  FROM contatos c
  INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
  WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
    AND c.empresa_id = p_empresa_id
  GROUP BY c.status;
$$;

-- Fix 2: get_desempenho_vendedores - include all sellers with attributed leads
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
  WITH event_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
      AND c.empresa_id = p_empresa_id
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)
      AND c.responsavel_email IS NOT NULL
      AND c.responsavel_email != ''
  ),
  -- Get team members (registered in equipe)
  team_members AS (
    SELECT DISTINCT
      p.id AS user_id,
      p.nome_completo,
      p.tipo_acesso,
      au.email
    FROM prospeccao_equipes eq
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    JOIN profiles p ON p.id = em.user_id
    JOIN auth.users au ON au.id = em.user_id
    WHERE eq.prospeccao_id = ANY(p_prospeccao_ids)
      AND eq.ativo = true
      AND p.tipo_acesso = 'Vendedor'
  ),
  -- Get sellers from leads that are NOT in the team
  extra_sellers AS (
    SELECT DISTINCT
      p.id AS user_id,
      p.nome_completo,
      p.tipo_acesso,
      au.email
    FROM event_contatos ec
    JOIN auth.users au ON au.email = ec.responsavel_email
    JOIN profiles p ON p.id = au.id
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = au.id
    )
  ),
  -- Union all sellers
  all_sellers AS (
    SELECT * FROM team_members
    UNION ALL
    SELECT * FROM extra_sellers
  )
  SELECT
    s.user_id,
    s.nome_completo,
    s.tipo_acesso,
    count(ec.id)::bigint AS atribuidos,
    count(*) FILTER (WHERE ec.status = 'Convidado')::bigint AS convidados,
    count(*) FILTER (WHERE ec.status = 'Agendado')::bigint AS agendados,
    count(*) FILTER (WHERE ec.status = 'Confirmado')::bigint AS confirmados,
    count(*) FILTER (WHERE ec.status = 'Check-in')::bigint AS checkins,
    count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas,
    count(*) FILTER (WHERE ec.status IN ('Descartado','Desperdício'))::bigint AS descartes
  FROM all_sellers s
  LEFT JOIN event_contatos ec ON (
    ec.responsavel_email = s.user_id::text
    OR ec.responsavel_email = s.email
  )
  GROUP BY s.user_id, s.nome_completo, s.tipo_acesso;
$$;

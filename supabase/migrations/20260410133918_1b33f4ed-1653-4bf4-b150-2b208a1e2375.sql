
CREATE OR REPLACE FUNCTION public.get_ranking_vendedores(p_prospeccao_ids uuid[], p_empresa_id uuid)
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
  WITH event_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
      AND c.empresa_id = p_empresa_id
      AND c.responsavel_email IS NOT NULL
      AND c.responsavel_email != ''
  ),
  team_members AS (
    SELECT DISTINCT
      p.id AS user_id,
      p.nome_completo,
      au.email
    FROM prospeccao_equipes eq
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    JOIN profiles p ON p.id = em.user_id
    JOIN auth.users au ON au.id = em.user_id
    WHERE eq.prospeccao_id = ANY(p_prospeccao_ids)
      AND eq.ativo = true
      AND p.tipo_acesso = 'Vendedor'
  ),
  extra_sellers AS (
    SELECT DISTINCT
      p.id AS user_id,
      p.nome_completo,
      au.email
    FROM event_contatos ec
    JOIN auth.users au ON au.email = ec.responsavel_email
    JOIN profiles p ON p.id = au.id
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = au.id
    )
  ),
  all_sellers AS (
    SELECT * FROM team_members
    UNION ALL
    SELECT * FROM extra_sellers
  )
  SELECT
    s.user_id,
    s.nome_completo,
    count(*) FILTER (WHERE ec.status IN ('Convidado','Confirmado','Check-in','Fechado','Venda'))::bigint AS convidados,
    count(*) FILTER (WHERE ec.status IN ('Check-in','Fechado','Venda'))::bigint AS checkins,
    count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas
  FROM all_sellers s
  LEFT JOIN event_contatos ec ON (
    ec.responsavel_email = s.user_id::text
    OR ec.responsavel_email = s.email
  )
  GROUP BY s.user_id, s.nome_completo;
$$;

DROP FUNCTION IF EXISTS public.get_desempenho_vendedores(uuid[],uuid,timestamp with time zone,timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_desempenho_vendedores(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid,
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid, nome_completo text, tipo_acesso text,
  atribuidos bigint, em_espera bigint, convidados bigint, agendados bigint, confirmados bigint,
  checkins bigint, vendas bigint, descartes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH alive_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = false
  ),
  snap_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = true
  ),
  alive_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status::text AS status
    FROM contatos c
    JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN alive_events ae ON ae.id = ep.prospeccao_id
    WHERE c.empresa_id = p_empresa_id
      AND c.responsavel_email IS NOT NULL AND c.responsavel_email <> ''
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)
  ),
  team_members AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, p.tipo_acesso, au.email
    FROM prospeccao_equipes eq
    JOIN alive_events ae ON ae.id = eq.prospeccao_id
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    JOIN profiles p ON p.id = em.user_id
    JOIN auth.users au ON au.id = em.user_id
    WHERE eq.ativo = true AND p.tipo_acesso = 'Vendedor'
  ),
  extra_sellers AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, p.tipo_acesso, au.email
    FROM alive_contatos ec
    JOIN auth.users au ON au.email = ec.responsavel_email OR au.id::text = ec.responsavel_email
    JOIN profiles p ON p.id = au.id
    WHERE NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = au.id)
  ),
  alive_sellers AS (
    SELECT * FROM team_members UNION ALL SELECT * FROM extra_sellers
  ),
  alive_result AS (
    SELECT
      s.user_id,
      s.nome_completo,
      s.tipo_acesso,
      count(ec.id)::bigint AS atribuidos,
      count(*) FILTER (WHERE ec.status = 'Em Espera')::bigint AS em_espera,
      count(*) FILTER (WHERE ec.status = 'Convidado')::bigint AS convidados,
      count(*) FILTER (WHERE ec.status = 'Agendado')::bigint AS agendados,
      count(*) FILTER (WHERE ec.status = 'Confirmado')::bigint AS confirmados,
      count(*) FILTER (WHERE ec.status = 'Check-in')::bigint AS checkins,
      count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas,
      count(*) FILTER (WHERE ec.status IN ('Descartado','Desperdício'))::bigint AS descartes
    FROM alive_sellers s
    LEFT JOIN alive_contatos ec ON ec.responsavel_email = s.user_id::text OR ec.responsavel_email = s.email
    GROUP BY s.user_id, s.nome_completo, s.tipo_acesso
  ),
  snap_rows AS (
    SELECT sl.contato_id, sl.responsavel_email, sl.responsavel_nome, sl.status
    FROM evento_snapshot_leads sl
    JOIN snap_events se ON se.id = sl.evento_id
    WHERE sl.responsavel_email IS NOT NULL AND sl.responsavel_email <> ''
      AND (p_date_start IS NULL OR sl.vinculado_em >= p_date_start)
      AND (p_date_end IS NULL OR sl.vinculado_em <= p_date_end)
  ),
  snap_result AS (
    SELECT
      au.id AS user_id,
      COALESCE(MAX(pr.nome_completo), MAX(sr.responsavel_nome), MAX(au.email), MAX(sr.responsavel_email)) AS nome_completo,
      MAX(pr.tipo_acesso) AS tipo_acesso,
      count(*)::bigint AS atribuidos,
      count(*) FILTER (WHERE sr.status = 'Em Espera')::bigint AS em_espera,
      count(*) FILTER (WHERE sr.status = 'Convidado')::bigint AS convidados,
      count(*) FILTER (WHERE sr.status = 'Agendado')::bigint AS agendados,
      count(*) FILTER (WHERE sr.status = 'Confirmado')::bigint AS confirmados,
      count(*) FILTER (WHERE sr.status = 'Check-in')::bigint AS checkins,
      count(*) FILTER (WHERE sr.status IN ('Fechado','Venda'))::bigint AS vendas,
      count(*) FILTER (WHERE sr.status IN ('Descartado','Desperdício'))::bigint AS descartes
    FROM snap_rows sr
    LEFT JOIN auth.users au ON au.email = sr.responsavel_email OR au.id::text = sr.responsavel_email
    LEFT JOIN profiles pr ON pr.id = au.id
    GROUP BY au.id, sr.responsavel_email
  )
  SELECT
    user_id,
    nome_completo,
    tipo_acesso,
    sum(atribuidos)::bigint,
    sum(em_espera)::bigint,
    sum(convidados)::bigint,
    sum(agendados)::bigint,
    sum(confirmados)::bigint,
    sum(checkins)::bigint,
    sum(vendas)::bigint,
    sum(descartes)::bigint
  FROM (
    SELECT * FROM alive_result
    UNION ALL
    SELECT * FROM snap_result
  ) x
  GROUP BY user_id, nome_completo, tipo_acesso;
$function$;
DROP FUNCTION IF EXISTS public.get_users_with_email(text[]);
DROP FUNCTION IF EXISTS public.get_users_with_email(text[], text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_users_with_email(
  p_tipo_acesso_filter text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  email text,
  nome_completo text,
  tipo_acesso text,
  departamento text,
  celular text,
  cpf text,
  status text,
  empresa_id uuid,
  created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT
      p.id,
      COALESCE(au.email::text, 'Email não disponível') AS email,
      p.nome_completo,
      p.tipo_acesso::text AS tipo_acesso,
      p.departamento,
      p.celular,
      p.cpf,
      p.status::text AS status,
      p.empresa_id,
      p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE p.tipo_acesso IS DISTINCT FROM 'Sistema'::tipo_acesso
      AND (p_tipo_acesso_filter IS NULL OR p.tipo_acesso::text = ANY(p_tipo_acesso_filter))
      AND (p_status IS NULL OR p.status::text = p_status)
      AND (
        p_search IS NULL OR p_search = '' OR
        p.nome_completo ILIKE '%' || p_search || '%' OR
        COALESCE(au.email::text, '') ILIKE '%' || p_search || '%' OR
        COALESCE(p.cpf, '') ILIKE '%' || p_search || '%' OR
        COALESCE(p.celular, '') ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total FROM filtered
  )
  SELECT
    f.id,
    f.email,
    f.nome_completo,
    f.tipo_acesso,
    f.departamento,
    f.celular,
    f.cpf,
    f.status,
    f.empresa_id,
    f.created_at,
    c.total AS total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$function$;
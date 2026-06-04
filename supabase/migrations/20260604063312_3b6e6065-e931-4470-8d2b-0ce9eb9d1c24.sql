CREATE OR REPLACE FUNCTION public.list_seat_usage()
RETURNS TABLE (
  empresa_id uuid,
  nome_empresa text,
  max_seats integer,
  in_use bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.nome_empresa,
    COALESCE(esl.max_seats, 5)::int AS max_seats,
    COALESCE((
      SELECT count(*) FROM public.external_access_seats s
      WHERE s.empresa_id = e.id AND s.status = 'active'
    ), 0) AS in_use
  FROM public.empresas e
  LEFT JOIN public.external_seat_limits esl ON esl.empresa_id = e.id
  WHERE public.is_admin()
  ORDER BY e.nome_empresa;
$$;

GRANT EXECUTE ON FUNCTION public.list_seat_usage() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_seat_limit(p_empresa_id uuid, p_max_seats integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_max_seats < 0 THEN
    RAISE EXCEPTION 'invalid value';
  END IF;

  SELECT max_seats INTO v_old FROM public.external_seat_limits WHERE empresa_id = p_empresa_id;

  INSERT INTO public.external_seat_limits (empresa_id, max_seats, updated_by)
  VALUES (p_empresa_id, p_max_seats, auth.uid())
  ON CONFLICT (empresa_id) DO UPDATE
    SET max_seats = EXCLUDED.max_seats,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

  INSERT INTO public.logs_cadeiras (acao, empresa_id, executado_por, metadata)
  VALUES ('limit_change', p_empresa_id, auth.uid(),
          jsonb_build_object('old', v_old, 'new', p_max_seats));
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_seat_limit(uuid, integer) TO authenticated;
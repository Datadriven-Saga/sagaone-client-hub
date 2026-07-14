
CREATE OR REPLACE FUNCTION public.expirar_cadeiras_vencidas()
RETURNS TABLE(seats_expirados int, profiles_desativados int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats int := 0;
  v_profiles int := 0;
BEGIN
  WITH updated AS (
    UPDATE public.external_access_seats s
    SET status = 'expired', updated_at = now()
    FROM public.prospeccoes p
    WHERE s.prospeccao_id = p.id
      AND s.status = 'active'
      AND p.data_fim < now()
    RETURNING s.profile_id
  )
  SELECT COUNT(*) INTO v_seats FROM updated;

  WITH deact AS (
    UPDATE public.profiles pr
    SET is_active = false, updated_at = now()
    WHERE pr.is_external = true
      AND pr.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.external_access_seats s
        WHERE s.profile_id = pr.id AND s.status = 'active'
      )
    RETURNING pr.id
  )
  SELECT COUNT(*) INTO v_profiles FROM deact;

  IF v_seats > 0 OR v_profiles > 0 THEN
    INSERT INTO public.logs_cadeiras (acao, metadata, created_at)
    VALUES (
      'deactivate',
      jsonb_build_object(
        'source', 'expirar_cadeiras_vencidas',
        'seats_expirados', v_seats,
        'profiles_desativados', v_profiles
      ),
      now()
    );
  END IF;

  RETURN QUERY SELECT v_seats, v_profiles;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expirar_cadeiras_vencidas() TO service_role;

SELECT public.expirar_cadeiras_vencidas();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expirar-cadeiras-vencidas-diario') THEN
    PERFORM cron.unschedule('expirar-cadeiras-vencidas-diario');
  END IF;
  PERFORM cron.schedule(
    'expirar-cadeiras-vencidas-diario',
    '0 3 * * *',
    $CRON$ SELECT public.expirar_cadeiras_vencidas(); $CRON$
  );
END $$;

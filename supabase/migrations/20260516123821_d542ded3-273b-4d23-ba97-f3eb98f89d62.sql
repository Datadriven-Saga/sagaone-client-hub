DO $$
DECLARE
  v_count INT;
BEGIN
  WITH batch AS (
    SELECT p.id FROM public.prospeccoes p
    WHERE p.data_fim IS NOT NULL
      AND p.data_fim < (now()::date - INTERVAL '7 days')
      AND p.snapshot_realizado = false
      AND COALESCE(p.is_teste, false) = false
    ORDER BY p.data_fim ASC LIMIT 100
  ),
  proc AS (
    SELECT (public.encerrar_eventos_finalizados(1, b.id, true)).* FROM batch b
  )
  SELECT count(*) INTO v_count FROM proc;
  RAISE NOTICE 'Batch processou % eventos', v_count;
END $$;
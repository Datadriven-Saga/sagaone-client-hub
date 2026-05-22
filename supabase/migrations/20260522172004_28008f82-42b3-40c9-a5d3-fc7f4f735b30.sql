
DO $$
DECLARE
  v_deleted_02228 int;
  v_deleted_56896 int;
BEGIN
  -- Evento 02228a03 — última importação (22/05 16:27 UTC)
  WITH del AS (
    DELETE FROM public.eventos_prospeccao
     WHERE prospeccao_id = '02228a03-2e36-4225-b9c8-cd61292e6699'
       AND created_at >= '2026-05-22 16:27:00+00'
       AND created_at <  '2026-05-22 16:45:00+00'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_02228 FROM del;

  IF v_deleted_02228 <> 86 THEN
    RAISE EXCEPTION 'Abort: evento 02228a03 apagou % linhas, esperado 86', v_deleted_02228;
  END IF;

  -- Evento 56896ecf — última importação (22/05 16:25 UTC)
  WITH del AS (
    DELETE FROM public.eventos_prospeccao
     WHERE prospeccao_id = '56896ecf-2b66-4d93-b4da-064e47fce692'
       AND created_at >= '2026-05-22 16:24:30+00'
       AND created_at <  '2026-05-22 16:45:00+00'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_56896 FROM del;

  IF v_deleted_56896 <> 698 THEN
    RAISE EXCEPTION 'Abort: evento 56896ecf apagou % linhas, esperado 698', v_deleted_56896;
  END IF;

  -- Marca import_logs como revertidos
  UPDATE public.import_logs
     SET status = 'reverted',
         message = COALESCE(message, '') || ' | revertido manualmente em ' || now()::text
   WHERE id IN ('272caded-1098-4355-927b-25550e95d784',
                'aefb9773-3390-4524-8886-4b21a11f30f2');

  RAISE NOTICE 'OK: 02228a03=% vínculos, 56896ecf=% vínculos', v_deleted_02228, v_deleted_56896;
END $$;

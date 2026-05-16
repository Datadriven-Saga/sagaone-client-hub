-- Tornar p_responsavel multi-valor (CSV) nas RPCs de Kanban/lista.
-- Backward compatible: valor único (sem vírgula) continua funcionando como antes.
DO $mig$
DECLARE
  v_def text;
BEGIN
  FOR v_def IN
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname IN ('get_kanban_columns', 'get_contatos_paginated')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE regexp_replace(
      v_def,
      'c\.responsavel_email = p_responsavel',
      'c.responsavel_email = ANY(string_to_array(p_responsavel, '',''))',
      'g'
    );
  END LOOP;
END
$mig$;

DO $$
DECLARE
  v_prosp uuid := '407a223d-de16-4b16-8e79-7e144ab1372a';
  v_contato uuid := '0be18b87-ff1f-4d91-9c55-c9c279c9905c';
  r record;
BEGIN
  -- Limpa tudo que referencia a prospecção
  FOR r IN
    SELECT conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.prospeccoes'::regclass
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING v_prosp;
  END LOOP;

  -- Limpa tudo que referencia o contato
  FOR r IN
    SELECT conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.contatos'::regclass
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING v_contato;
  END LOOP;

  DELETE FROM public.contatos WHERE id = v_contato;
  DELETE FROM public.prospeccoes WHERE id = v_prosp;
END $$;

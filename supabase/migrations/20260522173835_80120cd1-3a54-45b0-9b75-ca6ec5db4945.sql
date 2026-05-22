DO $$
DECLARE
  deleted_ids uuid[];
  deleted_links int;
  deleted_contatos int;
BEGIN
  -- Passo 1: apagar vínculos pendentes (não disparados) dos 2 eventos
  WITH del AS (
    DELETE FROM eventos_prospeccao
     WHERE prospeccao_id IN (
       '56896ecf-2b66-4d93-b4da-064e47fce692',
       '02228a03-2e36-4225-b9c8-cd61292e6699'
     )
     AND data_disparo_ia IS NULL
     RETURNING contato_id
  )
  SELECT array_agg(DISTINCT contato_id), COUNT(*) INTO deleted_ids, deleted_links FROM del;

  RAISE NOTICE 'Vínculos pendentes apagados: %', deleted_links;
  ASSERT deleted_links = 16038, format('Esperado 16038 vínculos, apagou %s', deleted_links);

  -- Passo 2: apagar contatos que ficaram órfãos
  WITH del AS (
    DELETE FROM contatos c
     WHERE c.id = ANY(deleted_ids)
       AND NOT EXISTS (
         SELECT 1 FROM eventos_prospeccao ep WHERE ep.contato_id = c.id
       )
     RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_contatos FROM del;

  RAISE NOTICE 'Contatos órfãos apagados: %', deleted_contatos;
END $$;
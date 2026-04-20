WITH contatos_evento AS (
  SELECT
    ep.id AS evento_prospeccao_id,
    ep.prospeccao_id,
    ep.contato_id,
    regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') AS telefone_digits,
    CASE
      WHEN length(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g')) = 11
       AND substring(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') from 3 for 1) = '9'
      THEN substring(regexp_replace(c.telefone, '\D', '', 'g') from 1 for 2)
         || substring(regexp_replace(c.telefone, '\D', '', 'g') from 4)
      ELSE regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g')
    END AS telefone_normalizado
  FROM public.eventos_prospeccao ep
  JOIN public.contatos c ON c.id = ep.contato_id
  WHERE ep.prospeccao_id = 'ebceadc3-24ed-418f-8bb9-901443190900'
), duplicados_legados AS (
  SELECT legado.evento_prospeccao_id
  FROM contatos_evento legado
  JOIN contatos_evento normalizado
    ON normalizado.prospeccao_id = legado.prospeccao_id
   AND normalizado.telefone_normalizado = legado.telefone_normalizado
   AND normalizado.contato_id <> legado.contato_id
  WHERE length(legado.telefone_digits) = 11
    AND substring(legado.telefone_digits from 3 for 1) = '9'
    AND length(normalizado.telefone_digits) = 10
)
DELETE FROM public.eventos_prospeccao ep
USING duplicados_legados d
WHERE ep.id = d.evento_prospeccao_id;
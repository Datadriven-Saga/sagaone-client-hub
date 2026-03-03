-- Backfill data_fim_evento from linked prospeccoes
UPDATE public.contato_quarentena cq
SET data_fim_evento = p.data_fim::timestamptz
FROM public.prospeccoes p
WHERE cq.prospeccao_id = p.id
  AND cq.data_fim_evento IS NULL
  AND p.data_fim IS NOT NULL;
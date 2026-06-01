-- Camada 2: Backfill empresa_id, marca, uf nos logs_disparos legados (origem='frontend')
-- Reversível, idempotente — só atualiza linhas onde marca IS NULL.
UPDATE public.logs_disparos ld
SET 
  empresa_id = COALESCE(ld.empresa_id, p.empresa_id),
  marca = COALESCE(ld.marca, e.marca),
  uf = COALESCE(ld.uf, e.uf)
FROM public.prospeccoes p
JOIN public.empresas e ON e.id = p.empresa_id
WHERE ld.prospeccao_id = p.id
  AND ld.origem = 'frontend'
  AND (ld.marca IS NULL OR ld.uf IS NULL OR ld.empresa_id IS NULL);
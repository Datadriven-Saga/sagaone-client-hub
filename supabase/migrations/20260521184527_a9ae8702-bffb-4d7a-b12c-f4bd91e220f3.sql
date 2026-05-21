-- Fase 5: Migrar delta (15 anotações criadas entre backup e publish) + DELETE em eventos_prospeccao

-- 1. Backup do delta (segurança extra)
CREATE TABLE IF NOT EXISTS public.eventos_prospeccao_backup_anotacoes_delta AS
SELECT * FROM public.eventos_prospeccao ep
WHERE ep.tipo_evento = 'Anotação'
  AND NOT EXISTS (SELECT 1 FROM public.eventos_prospeccao_backup_anotacoes b WHERE b.id = ep.id);

-- 2. Migrar delta pra contato_anotacoes (apenas registros com usuario_id válido)
INSERT INTO public.contato_anotacoes (contato_id, usuario_id, empresa_id, descricao, prospeccao_id, created_at)
SELECT 
  ep.contato_id,
  ep.usuario_id,
  COALESCE(c.empresa_id, p.empresa_id) AS empresa_id,
  ep.descricao,
  ep.prospeccao_id,
  ep.created_at
FROM public.eventos_prospeccao ep
LEFT JOIN public.contatos c ON c.id = ep.contato_id
LEFT JOIN public.prospeccoes p ON p.id = ep.prospeccao_id
WHERE ep.tipo_evento = 'Anotação'
  AND ep.usuario_id IS NOT NULL
  AND ep.contato_id IS NOT NULL
  AND COALESCE(c.empresa_id, p.empresa_id) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.eventos_prospeccao_backup_anotacoes b WHERE b.id = ep.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.contato_anotacoes ca
    WHERE ca.contato_id = ep.contato_id
      AND ca.usuario_id = ep.usuario_id
      AND ca.descricao = ep.descricao
      AND ca.created_at = ep.created_at
  );

-- 3. DELETE final — remove TODAS as anotações de eventos_prospeccao
-- Backup completo já existe em eventos_prospeccao_backup_anotacoes + delta
DELETE FROM public.eventos_prospeccao WHERE tipo_evento = 'Anotação';
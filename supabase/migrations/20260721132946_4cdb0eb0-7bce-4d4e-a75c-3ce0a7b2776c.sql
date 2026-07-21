
-- Fase 3: get_contato_status_por_evento ignora logs espúrios auto-trigger, sem apagar dados
CREATE OR REPLACE FUNCTION public.get_contato_status_por_evento(
  p_contato_id uuid, p_prospeccao_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT lm.status_novo
       FROM public.logs_movimentacao_contatos lm
      WHERE lm.contato_id = p_contato_id
        AND lm.prospeccao_id = p_prospeccao_id
        AND lm.status_novo IS NOT NULL
        AND COALESCE(lm.observacoes,'') NOT ILIKE 'auto-trigger%'
        AND COALESCE(lm.observacoes,'') NOT ILIKE '%fallback de migracao%'
      ORDER BY lm.data_movimentacao DESC
      LIMIT 1),
    (SELECT c.status::text FROM public.contatos c WHERE c.id = p_contato_id),
    'Novo'
  );
$$;

COMMENT ON FUNCTION public.get_contato_status_por_evento IS
  'Fase 3 (2026-07-21): ignora logs com observacoes iniciando por "auto-trigger" ou contendo "fallback de migracao". Registros permanecem em logs_movimentacao_contatos para auditoria.';

-- Front A: Ocultar entradas de sistema na timeline do lead
-- Não deleta dados; apenas filtra na leitura via RPC.
-- Rollback: recriar versão anterior (sem WHERE NOT (...))

CREATE OR REPLACE FUNCTION public.get_contato_timeline(
  p_contato_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, tipo text, descricao text, metadata jsonb,
  usuario_nome text, created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, tipo, descricao, metadata, usuario_nome, created_at
  FROM public.contato_timeline
  WHERE contato_id = p_contato_id
    AND NOT (
      tipo = 'status_change'
      AND (usuario_id IS NULL OR usuario_nome IS NULL OR usuario_nome ILIKE 'Sistema%')
      AND (
        descricao ILIKE '%Reset de herança%'
        OR descricao ILIKE '%Correção automática%'
        OR descricao ILIKE '%auto-trigger%'
        OR descricao ILIKE '%Alterado pelo sistema%'
      )
    )
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;
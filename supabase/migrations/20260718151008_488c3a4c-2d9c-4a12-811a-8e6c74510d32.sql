-- Fix: get_contato_status_por_evento agora usa contatos.status como fallback
-- em vez de 'Novo' fixo. Sem isso, milhares de leads atribuídos antes de 2026-07
-- (que não têm log em logs_movimentacao_contatos para o evento) aparecem
-- incorretamente como "Novo" no Kanban/Base, mesmo continuando atribuídos de fato.
-- Nenhum dado é alterado; muda apenas a regra de leitura.

CREATE OR REPLACE FUNCTION public.get_contato_status_por_evento(p_contato_id uuid, p_prospeccao_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT lm.status_novo
       FROM public.logs_movimentacao_contatos lm
      WHERE lm.contato_id = p_contato_id
        AND lm.prospeccao_id = p_prospeccao_id
        AND lm.status_novo IS NOT NULL
      ORDER BY lm.data_movimentacao DESC
      LIMIT 1),
    (SELECT c.status::text FROM public.contatos c WHERE c.id = p_contato_id),
    'Novo'
  );
$function$;
DROP FUNCTION IF EXISTS public.encerrar_eventos_finalizados(INT, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.encerrar_eventos_finalizados(
  p_limit INT DEFAULT 50,
  p_evento_id UUID DEFAULT NULL,
  p_skip_descarte BOOLEAN DEFAULT false
)
RETURNS TABLE(
  out_evento_id UUID,
  out_snapshot_count INT,
  out_descarte_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evento RECORD;
  v_snapshot_count INT;
  v_descarte_count INT;
BEGIN
  FOR v_evento IN
    SELECT p.id, p.empresa_id
    FROM public.prospeccoes p
    WHERE p.data_fim IS NOT NULL
      AND p.data_fim < now()::date
      AND p.snapshot_realizado = false
      AND COALESCE(p.is_teste, false) = false
      AND (p_evento_id IS NULL OR p.id = p_evento_id)
    ORDER BY p.data_fim ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.evento_snapshot_leads esl WHERE esl.evento_id = v_evento.id;

    INSERT INTO public.evento_snapshot_leads (
      evento_id, contato_id, telefone, nome, email,
      status, responsavel_nome, responsavel_email,
      codigo_proposta, vinculado_em
    )
    SELECT DISTINCT ON (c.id)
      v_evento.id, c.id, c.telefone, c.nome, c.email,
      c.status::TEXT, c.vendedor_nome, c.responsavel_email,
      c.codigo_proposta, ep.created_at
    FROM public.eventos_prospeccao ep
    JOIN public.contatos c ON c.id = ep.contato_id
    WHERE ep.prospeccao_id = v_evento.id
      AND ep.contato_id IS NOT NULL;

    GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
    v_descarte_count := 0;

    IF NOT p_skip_descarte THEN
      UPDATE public.contatos c
      SET status = 'Descartado'::status_lead,
          updated_at = now()
      WHERE c.id IN (
        SELECT ep.contato_id
        FROM public.eventos_prospeccao ep
        WHERE ep.prospeccao_id = v_evento.id
          AND ep.contato_id IS NOT NULL
      )
      AND c.status::text NOT IN ('Convidado','Confirmado','Check-in','Agendado','Venda','Ganho')
      AND c.empresa_id = v_evento.empresa_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.eventos_prospeccao ep2
        JOIN public.prospeccoes p2 ON p2.id = ep2.prospeccao_id
        WHERE ep2.contato_id = c.id
          AND p2.id <> v_evento.id
          AND p2.snapshot_realizado = false
          AND (p2.data_fim IS NULL OR p2.data_fim >= now()::date)
      );

      GET DIAGNOSTICS v_descarte_count = ROW_COUNT;
    END IF;

    UPDATE public.prospeccoes
    SET snapshot_realizado = true,
        encerrado_at = now()
    WHERE id = v_evento.id;

    out_evento_id := v_evento.id;
    out_snapshot_count := v_snapshot_count;
    out_descarte_count := v_descarte_count;
    RETURN NEXT;

    RAISE LOG 'Evento % encerrado: % snapshot, % descartados (skip_descarte=%)',
      v_evento.id, v_snapshot_count, v_descarte_count, p_skip_descarte;
  END LOOP;
END;
$function$;

-- TESTE: evento admin único, com descarte normal
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.encerrar_eventos_finalizados(1, 'ba1dc6ac-1ec6-461f-9801-88ac352f6258'::uuid, false) LOOP
    RAISE NOTICE 'TESTE ADMIN -> evento=% snapshot=% descarte=%', r.out_evento_id, r.out_snapshot_count, r.out_descarte_count;
  END LOOP;
END $$;
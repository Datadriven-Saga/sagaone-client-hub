CREATE OR REPLACE FUNCTION public.sync_leads_confirmacao(p_evento_confirmacao_id uuid, p_filtro_status text[] DEFAULT ARRAY['Convidado'::text])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evento_pai_id UUID;
  v_empresa_id UUID;
  v_novos INT := 0;
  v_ja_vinculados INT := 0;
  v_contato RECORD;
BEGIN
  SELECT evento_pai_id, empresa_id
  INTO v_evento_pai_id, v_empresa_id
  FROM public.prospeccoes
  WHERE id = p_evento_confirmacao_id
    AND evento_confirmacao = true;

  IF v_evento_pai_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Evento não é de confirmação ou não tem evento pai');
  END IF;

  IF NOT public.user_can_access_empresa(v_empresa_id, auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Sem acesso a esta empresa');
  END IF;

  FOR v_contato IN
    SELECT DISTINCT c.id AS contato_id
    FROM public.eventos_prospeccao ep
    JOIN public.contatos c ON c.id = ep.contato_id
    WHERE ep.prospeccao_id = v_evento_pai_id
      AND c.status::TEXT = ANY (p_filtro_status)
      AND c.empresa_id = v_empresa_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.eventos_prospeccao
      WHERE contato_id = v_contato.contato_id
        AND prospeccao_id = p_evento_confirmacao_id
    ) THEN
      v_ja_vinculados := v_ja_vinculados + 1;
    ELSE
      INSERT INTO public.eventos_prospeccao (
        contato_id, prospeccao_id, sincronizado_de_evento_id
      ) VALUES (
        v_contato.contato_id, p_evento_confirmacao_id, v_evento_pai_id
      );
      v_novos := v_novos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'novos', v_novos,
    'ja_vinculados', v_ja_vinculados,
    'total', v_novos + v_ja_vinculados
  );
END;
$function$;
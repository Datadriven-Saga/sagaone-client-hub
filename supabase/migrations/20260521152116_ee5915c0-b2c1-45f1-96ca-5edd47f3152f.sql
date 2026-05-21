
ALTER TABLE public.prospeccoes
  ADD COLUMN IF NOT EXISTS evento_pai_id UUID REFERENCES public.prospeccoes(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_confirmacao_pai'
      AND conrelid = 'public.prospeccoes'::regclass
  ) THEN
    ALTER TABLE public.prospeccoes
      ADD CONSTRAINT chk_confirmacao_pai CHECK (
        (evento_confirmacao = true AND evento_pai_id IS NOT NULL)
        OR
        (evento_confirmacao = false AND evento_pai_id IS NULL)
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prospeccoes_evento_pai
  ON public.prospeccoes (evento_pai_id)
  WHERE evento_pai_id IS NOT NULL;

ALTER TABLE public.eventos_prospeccao
  ADD COLUMN IF NOT EXISTS sincronizado_de_evento_id UUID REFERENCES public.prospeccoes(id);

CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_sincronizado_de
  ON public.eventos_prospeccao (sincronizado_de_evento_id)
  WHERE sincronizado_de_evento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_leads_confirmacao(
  p_evento_confirmacao_id UUID,
  p_filtro_status TEXT[] DEFAULT ARRAY['Convidado']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NOT public.user_can_access_empresa(auth.uid(), v_empresa_id) THEN
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
        contato_id, prospeccao_id, sincronizado_de_evento_id, tipo_evento
      ) VALUES (
        v_contato.contato_id, p_evento_confirmacao_id, v_evento_pai_id, 'mensagem'
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
$$;

GRANT EXECUTE ON FUNCTION public.sync_leads_confirmacao(UUID, TEXT[]) TO authenticated;

-- =====================================================================
-- Fix: quarentena duplicate key violation no índice
-- idx_quarentena_telefone_empresa_canal
--
-- Problema:
--   - upsert_quarentena resolve ON CONFLICT em (telefone, marca, canal)
--     WHERE marca IS NOT NULL (índice parcial)
--   - mas existe outro índice UNIQUE em (telefone, empresa_id, canal)
--   - quando o mesmo telefone já está em quarentena por outra loja
--     da MESMA marca, a inserção dispara duplicate key, o ON CONFLICT
--     não cobre essa chave, e a linha existente não é atualizada.
--
-- Solução (camadas 4 + 4):
--   1. Trocar idx_quarentena_telefone_empresa_canal de UNIQUE para
--      índice normal (a regra de negócio é por marca+canal, não por
--      empresa+canal — alinhado à memória `quarentena/visibility-by-brand`).
--   2. Endurecer upsert_quarentena com UPDATE-first por (telefone,
--      marca, canal) antes do INSERT, evitando depender exclusivamente
--      do ON CONFLICT e cobrindo o caso de troca de empresa_id.
-- =====================================================================

-- 1) Substituir índice único por não-único (mantém ganho de leitura)
DROP INDEX IF EXISTS public.idx_quarentena_telefone_empresa_canal;

CREATE INDEX IF NOT EXISTS idx_quarentena_telefone_empresa_canal
  ON public.contato_quarentena
  USING btree (telefone_normalizado, empresa_id, canal);

-- 2) Endurecer upsert_quarentena com UPDATE-first
CREATE OR REPLACE FUNCTION public.upsert_quarentena(
  p_telefone text,
  p_loja_id uuid,
  p_prospeccao_id uuid,
  p_evento_nome text,
  p_data_fim_evento timestamp with time zone,
  p_canal text DEFAULT 'whatsapp'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca text;
  v_updated int;
BEGIN
  -- Whitelist: telefones nunca entram em quarentena
  IF EXISTS (
    SELECT 1 FROM public.quarentena_exclusoes
    WHERE telefone_normalizado = p_telefone
  ) THEN
    RETURN;
  END IF;

  -- Marca é mandatória (bloqueio é por marca+canal)
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;
  IF v_marca IS NULL THEN
    RETURN;
  END IF;

  -- UPDATE-first: se já existe registro para (telefone, marca, canal),
  -- atualiza inclusive trocando empresa_id para a loja mais recente.
  UPDATE public.contato_quarentena
  SET
    empresa_id       = p_loja_id,
    prospeccao_id    = p_prospeccao_id,
    evento_nome      = p_evento_nome,
    data_fim_evento  = p_data_fim_evento,
    ultimo_impacto_at = now(),
    desativado       = false,
    desativado_por   = NULL,
    desativado_em    = NULL,
    updated_at       = now()
  WHERE telefone_normalizado = p_telefone
    AND marca = v_marca
    AND canal = p_canal;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN;
  END IF;

  -- INSERT com ON CONFLICT redundante como salvaguarda contra race
  INSERT INTO public.contato_quarentena (
    telefone_normalizado, empresa_id, marca, prospeccao_id,
    evento_nome, data_fim_evento, ultimo_impacto_at, canal
  ) VALUES (
    p_telefone, p_loja_id, v_marca, p_prospeccao_id,
    p_evento_nome, p_data_fim_evento, now(), p_canal
  )
  ON CONFLICT (telefone_normalizado, marca, canal) WHERE marca IS NOT NULL
  DO UPDATE SET
    empresa_id        = EXCLUDED.empresa_id,
    prospeccao_id     = EXCLUDED.prospeccao_id,
    evento_nome       = EXCLUDED.evento_nome,
    data_fim_evento   = EXCLUDED.data_fim_evento,
    ultimo_impacto_at = now(),
    desativado        = false,
    desativado_por    = NULL,
    desativado_em     = NULL,
    updated_at        = now();
END;
$function$;
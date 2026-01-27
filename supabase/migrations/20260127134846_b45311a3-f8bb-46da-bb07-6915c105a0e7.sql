-- Ajustar cronograma para não usar mais "fase"/"unidades" e permitir vincular um agente do Controle de Agentes
ALTER TABLE public.cronograma_implantacao
  DROP COLUMN IF EXISTS fase,
  DROP COLUMN IF EXISTS unidades;

ALTER TABLE public.cronograma_implantacao
  ADD COLUMN IF NOT EXISTS controle_agente_id uuid,
  ADD COLUMN IF NOT EXISTS responsavel text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cronograma_implantacao_controle_agente_id_fkey'
  ) THEN
    ALTER TABLE public.cronograma_implantacao
      ADD CONSTRAINT cronograma_implantacao_controle_agente_id_fkey
      FOREIGN KEY (controle_agente_id)
      REFERENCES public.controle_agentes(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_cronograma_controle_agente_id
  ON public.cronograma_implantacao (controle_agente_id);

CREATE INDEX IF NOT EXISTS idx_cronograma_data_inicio
  ON public.cronograma_implantacao (data_inicio);


ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS temperatura_id uuid NULL
  REFERENCES public.temperaturas_lead(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contatos_temperatura
  ON public.contatos(temperatura_id)
  WHERE temperatura_id IS NOT NULL;

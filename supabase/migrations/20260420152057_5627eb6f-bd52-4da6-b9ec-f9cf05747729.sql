ALTER TABLE public.prospeccoes
ADD COLUMN IF NOT EXISTS tipo_lead TEXT NOT NULL DEFAULT 'vendas';

ALTER TABLE public.prospeccoes
DROP CONSTRAINT IF EXISTS prospeccoes_tipo_lead_check;

ALTER TABLE public.prospeccoes
ADD CONSTRAINT prospeccoes_tipo_lead_check
CHECK (tipo_lead IN ('vendas', 'prospeccao', 'relacionamento'));
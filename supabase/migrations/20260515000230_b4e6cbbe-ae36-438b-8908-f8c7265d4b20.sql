ALTER TABLE public.eventos_prospeccao
  ADD COLUMN IF NOT EXISTS confirmation_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_prospeccao_confirmation_token
  ON public.eventos_prospeccao(confirmation_token)
  WHERE confirmation_token IS NOT NULL;
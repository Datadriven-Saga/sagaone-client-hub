-- Adiciona campo de confirmação de presença
ALTER TABLE public.contatos
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;

-- Índice para busca rápida por qr_token na Edge Function pública
CREATE INDEX IF NOT EXISTS idx_contatos_qr_token ON public.contatos(qr_token) WHERE qr_token IS NOT NULL;
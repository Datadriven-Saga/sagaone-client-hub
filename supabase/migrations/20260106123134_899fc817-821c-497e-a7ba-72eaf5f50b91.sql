-- Add columns for QR token tracking
ALTER TABLE public.contatos
ADD COLUMN IF NOT EXISTS qr_token UUID UNIQUE,
ADD COLUMN IF NOT EXISTS qr_token_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS qr_token_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vendedor_nome TEXT;

-- Create index for faster qr_token lookups
CREATE INDEX IF NOT EXISTS idx_contatos_qr_token ON public.contatos(qr_token) WHERE qr_token IS NOT NULL;
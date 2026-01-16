-- Adicionar coluna para armazenar o QR code gerado
ALTER TABLE public.contatos 
ADD COLUMN IF NOT EXISTS qr_code_image TEXT;
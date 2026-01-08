-- Adicionar colunas cidade e endereco à tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT;
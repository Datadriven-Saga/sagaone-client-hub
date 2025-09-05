-- Remove the razao_social column from empresas table
ALTER TABLE public.empresas DROP COLUMN IF EXISTS razao_social;

-- Add new columns to empresas table
ALTER TABLE public.empresas 
ADD COLUMN crm_id TEXT,
ADD COLUMN uf TEXT,
ADD COLUMN marca TEXT;
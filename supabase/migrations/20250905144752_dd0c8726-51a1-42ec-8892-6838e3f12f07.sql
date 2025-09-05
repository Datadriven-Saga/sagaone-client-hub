-- Remove campos E-mail, Site e Endereço da tabela empresas
ALTER TABLE public.empresas 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS site,
DROP COLUMN IF EXISTS endereco;
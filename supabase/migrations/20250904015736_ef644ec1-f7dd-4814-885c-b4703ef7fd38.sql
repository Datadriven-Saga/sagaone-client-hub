-- Alterar tabela contatos para usar email do responsável ao invés de ID
ALTER TABLE public.contatos 
DROP COLUMN IF EXISTS responsavel_id;

ALTER TABLE public.contatos 
ADD COLUMN responsavel_email TEXT;

-- Criar índice para performance na busca por email
CREATE INDEX IF NOT EXISTS idx_contatos_responsavel_email ON public.contatos(responsavel_email);

-- Comentário para documentar a mudança
COMMENT ON COLUMN public.contatos.responsavel_email IS 'Email do usuário responsável pelo contato';
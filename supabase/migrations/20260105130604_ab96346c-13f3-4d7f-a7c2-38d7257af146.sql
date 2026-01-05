-- Criar sequência para gerar IDs seriais
CREATE SEQUENCE IF NOT EXISTS contatos_lead_id_seq START WITH 1 INCREMENT BY 1;

-- Adicionar coluna lead_id na tabela contatos
ALTER TABLE public.contatos 
ADD COLUMN lead_id INTEGER UNIQUE DEFAULT nextval('contatos_lead_id_seq');

-- Preencher lead_id para registros existentes que não têm
UPDATE public.contatos 
SET lead_id = nextval('contatos_lead_id_seq') 
WHERE lead_id IS NULL;

-- Criar índice para busca rápida por lead_id
CREATE INDEX idx_contatos_lead_id ON public.contatos(lead_id);

-- Comentário explicativo
COMMENT ON COLUMN public.contatos.lead_id IS 'Identificador serial único do lead para integração com sistemas externos';
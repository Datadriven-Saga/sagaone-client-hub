-- Primeiro, vamos garantir que não existem duplicatas antes de criar os constraints
-- Remover possíveis duplicatas baseadas em email+prospecção
DELETE FROM public.contatos c1 
WHERE EXISTS (
    SELECT 1 FROM public.contatos c2 
    WHERE c1.email = c2.email 
    AND c1.prospeccao_id = c2.prospeccao_id 
    AND c1.id > c2.id
    AND c1.email IS NOT NULL
);

-- Adicionar constraint único para email+prospecção (quando email não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS unique_email_prospeccao 
ON public.contatos (email, prospeccao_id) 
WHERE email IS NOT NULL AND email != '';

-- Para casos onde email é nulo, garantir unicidade por nome+telefone+prospecção
CREATE UNIQUE INDEX IF NOT EXISTS unique_nome_telefone_prospeccao 
ON public.contatos (nome, telefone, prospeccao_id, empresa_id) 
WHERE (email IS NULL OR email = '');

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_id ON public.contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contatos_prospeccao_id ON public.contatos(prospeccao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospeccoes_empresa_id ON public.prospeccoes(empresa_id);
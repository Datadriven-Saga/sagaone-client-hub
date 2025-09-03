-- Verificar se existe algum relacionamento entre contatos e prospecções
-- Primeiro, vamos ver os nomes corretos das colunas da tabela contatos

-- Adicionar constraint único baseado nos campos corretos da tabela contatos
-- Assumindo que o relacionamento é através de outra estrutura

-- Constraint para garantir que o mesmo email não seja duplicado
CREATE UNIQUE INDEX IF NOT EXISTS unique_email_empresa 
ON public.contatos (email, empresa_id) 
WHERE email IS NOT NULL AND email != '';

-- Adicionar índices para performance nos campos existentes
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_id ON public.contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contatos_cliente_id ON public.contatos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contatos_responsavel_id ON public.contatos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospeccoes_empresa_id ON public.prospeccoes(empresa_id);
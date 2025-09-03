-- Adicionar constraint único para garantir que um contato só pode ser adicionado uma vez por prospecção
ALTER TABLE public.contatos 
ADD CONSTRAINT unique_contato_prospeccao 
UNIQUE (email, prospeccao_id) 
WHERE email IS NOT NULL;

-- Adicionar constraint para nome quando email for nulo
ALTER TABLE public.contatos 
ADD CONSTRAINT unique_nome_prospeccao 
UNIQUE (nome, prospeccao_id, empresa_id);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_id ON public.contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contatos_prospeccao_id ON public.contatos(prospeccao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospeccoes_empresa_id ON public.prospeccoes(empresa_id);

-- Garantir que todas as queries considerem a empresa ativa do usuário
-- Atualizar políticas RLS para ser mais restritiva

-- Atualizar política de contatos para garantir isolamento por empresa
DROP POLICY IF EXISTS "Usuários podem gerenciar leads da empresa" ON public.contatos;
DROP POLICY IF EXISTS "Usuários podem ver leads da empresa" ON public.contatos;

CREATE POLICY "Users can manage contacts from their active company" 
ON public.contatos 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Atualizar política de clientes 
DROP POLICY IF EXISTS "Usuários podem gerenciar clientes da empresa" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem ver clientes da empresa" ON public.clientes;

CREATE POLICY "Users can manage clients from their active company" 
ON public.clientes 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Atualizar política de prospecções
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.prospeccoes;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.prospeccoes;

CREATE POLICY "Users can manage prospecting from their active company" 
ON public.prospeccoes 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Políticas para outros módulos
-- Personas
DROP POLICY IF EXISTS "Usuários podem gerenciar personas da empresa" ON public.personas;
DROP POLICY IF EXISTS "Usuários podem ver personas da empresa" ON public.personas;

CREATE POLICY "Users can manage personas from their active company" 
ON public.personas 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Metas  
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.metas;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.metas;

CREATE POLICY "Users can manage goals from their active company" 
ON public.metas 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Gatilhos
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.gatilhos;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.gatilhos;

CREATE POLICY "Users can manage triggers from their active company" 
ON public.gatilhos 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Produtos
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.produtos;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.produtos;

CREATE POLICY "Users can manage products from their active company" 
ON public.produtos 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Vendas
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.vendas;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.vendas;

CREATE POLICY "Users can manage sales from their active company" 
ON public.vendas 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Treinamentos
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.treinamentos;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.treinamentos;

CREATE POLICY "Users can manage training from their active company" 
ON public.treinamentos 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Relatórios
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.relatorios;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.relatorios;

CREATE POLICY "Users can manage reports from their active company" 
ON public.relatorios 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());
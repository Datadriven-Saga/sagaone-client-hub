-- Implementar políticas RLS para todos os módulos restantes baseadas na empresa ativa

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

-- Itens de venda (relacionados às vendas)
DROP POLICY IF EXISTS "Usuários podem ver itens de venda" ON public.itens_venda;
DROP POLICY IF EXISTS "Usuários podem inserir itens de venda" ON public.itens_venda;
DROP POLICY IF EXISTS "Usuários podem atualizar itens de venda" ON public.itens_venda;
DROP POLICY IF EXISTS "Usuários podem deletar itens de venda" ON public.itens_venda;

CREATE POLICY "Users can manage sale items from their active company" 
ON public.itens_venda 
FOR ALL 
USING (
    venda_id IN (
        SELECT id FROM public.vendas 
        WHERE empresa_id = get_user_active_company()
    )
)
WITH CHECK (
    venda_id IN (
        SELECT id FROM public.vendas 
        WHERE empresa_id = get_user_active_company()
    )
);
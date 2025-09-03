-- Agora vamos atualizar as políticas RLS para garantir isolamento por empresa ativa

-- Atualizar política de contatos para usar empresa ativa
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

-- Políticas para outros módulos usando empresa ativa
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
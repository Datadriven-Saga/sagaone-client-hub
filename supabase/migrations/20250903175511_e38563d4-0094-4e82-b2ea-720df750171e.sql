-- Agora vamos implementar as políticas RLS corretas baseadas na empresa ativa do usuário

-- Atualizar política de contatos para garantir isolamento por empresa ativa
DROP POLICY IF EXISTS "Usuários podem gerenciar leads da empresa" ON public.contatos;
DROP POLICY IF EXISTS "Usuários podem ver leads da empresa" ON public.contatos;
DROP POLICY IF EXISTS "Users can manage contacts from their active company" ON public.contatos;

CREATE POLICY "Users can manage contacts from their active company" 
ON public.contatos 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Atualizar política de clientes 
DROP POLICY IF EXISTS "Usuários podem gerenciar clientes da empresa" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem ver clientes da empresa" ON public.clientes;
DROP POLICY IF EXISTS "Users can manage clients from their active company" ON public.clientes;

CREATE POLICY "Users can manage clients from their active company" 
ON public.clientes 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Atualizar política de prospecções
DROP POLICY IF EXISTS "Usuários podem gerenciar dados da empresa" ON public.prospeccoes;
DROP POLICY IF EXISTS "Usuários podem ver dados da empresa" ON public.prospeccoes;
DROP POLICY IF EXISTS "Users can manage prospecting from their active company" ON public.prospeccoes;

CREATE POLICY "Users can manage prospecting from their active company" 
ON public.prospeccoes 
FOR ALL 
USING (empresa_id = get_user_active_company())
WITH CHECK (empresa_id = get_user_active_company());

-- Garantir que eventos de prospecção respeitam o isolamento por empresa
DROP POLICY IF EXISTS "Usuários podem ver eventos de prospecção" ON public.eventos_prospeccao;
DROP POLICY IF EXISTS "Usuários podem inserir eventos de prospecção" ON public.eventos_prospeccao;
DROP POLICY IF EXISTS "Usuários podem atualizar eventos de prospecção" ON public.eventos_prospeccao;
DROP POLICY IF EXISTS "Usuários podem deletar eventos de prospecção" ON public.eventos_prospeccao;

-- Criar política unificada para eventos de prospecção baseada na empresa da prospecção
CREATE POLICY "Users can manage prospecting events from their active company" 
ON public.eventos_prospeccao 
FOR ALL 
USING (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
)
WITH CHECK (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
);
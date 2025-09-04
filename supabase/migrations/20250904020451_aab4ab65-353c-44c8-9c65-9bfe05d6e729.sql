-- CORREÇÃO CRÍTICA DE SEGURANÇA: Recriar políticas RLS seguras

-- 1. Criar função security definer para obter email do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    ''
  );
$$;

-- 2. Criar função para verificar se usuário está na mesma empresa
CREATE OR REPLACE FUNCTION public.user_in_same_company(target_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    target_empresa_id = get_user_active_company(auth.uid()),
    false
  );
$$;

-- 3. TABELA CLIENTES - Políticas ultra-restritivas
DROP POLICY IF EXISTS "Administrators and managers can access all company clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can access their assigned clients" ON public.clientes;

-- Apenas administradores/gerentes da MESMA empresa podem ver todos os clientes
CREATE POLICY "Company admins only - all clients"
ON public.clientes
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Usuários só podem ver clientes que CRIARAM ou que têm contatos atribuídos
CREATE POLICY "Users own clients only"
ON public.clientes
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND (
    user_id = auth.uid()
    OR id IN (
      SELECT DISTINCT cliente_id
      FROM contatos 
      WHERE responsavel_email = get_current_user_email()
      AND cliente_id IS NOT NULL
      AND empresa_id = get_user_active_company()
    )
  )
);

-- Apenas administradores/gerentes podem inserir/atualizar/deletar clientes
CREATE POLICY "Company admins only - modify clients"
ON public.clientes
FOR ALL
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 4. TABELA CONTATOS - Políticas ultra-restritivas  
DROP POLICY IF EXISTS "Administrators and managers can access all company contacts" ON public.contatos;
DROP POLICY IF EXISTS "Users can access their assigned contacts" ON public.contatos;

-- Apenas administradores/gerentes da MESMA empresa podem ver todos os contatos
CREATE POLICY "Company admins only - all contacts"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Usuários só podem ver contatos ATRIBUÍDOS A ELES
CREATE POLICY "Users assigned contacts only"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND responsavel_email = get_current_user_email()
);

-- Apenas administradores/gerentes podem inserir/atualizar/deletar contatos
CREATE POLICY "Company admins only - modify contacts"
ON public.contatos
FOR ALL
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 5. TABELA EMPRESAS - Política ultra-restritiva
DROP POLICY IF EXISTS "Users can view companies they have access to" ON public.empresas;

-- Usuários só podem ver SUA empresa ativa
CREATE POLICY "Users own company only"
ON public.empresas
FOR SELECT
USING (
  id = get_user_active_company(auth.uid())
  OR is_admin()
);

-- 6. TABELA PROFILES - Política ultra-restritiva
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;

-- Usuários só podem ver SEU PRÓPRIO perfil
CREATE POLICY "Users own profile only"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR is_admin()
);

-- 7. TABELA VENDAS - Políticas ultra-restritivas
DROP POLICY IF EXISTS "Administrators and managers can access all company sales" ON public.vendas;
DROP POLICY IF EXISTS "Users can access their own sales" ON public.vendas;

-- Apenas administradores/gerentes da MESMA empresa podem ver todas as vendas
CREATE POLICY "Company admins only - all sales"
ON public.vendas
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Usuários só podem ver SUAS PRÓPRIAS vendas
CREATE POLICY "Users own sales only"
ON public.vendas
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND vendedor_id = auth.uid()
);

-- Apenas administradores/gerentes podem modificar vendas
CREATE POLICY "Company admins only - modify sales"
ON public.vendas
FOR ALL
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);
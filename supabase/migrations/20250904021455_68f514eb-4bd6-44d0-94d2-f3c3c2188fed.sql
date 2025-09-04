-- IMPLEMENTAÇÃO DE SEGURANÇA ROBUSTA: Default Deny + Políticas Explícitas

-- 1. FORÇA RLS em todas as tabelas sensíveis (garantir que não pode ser desabilitado)
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contatos FORCE ROW LEVEL SECURITY; 
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendas FORCE ROW LEVEL SECURITY;

-- 2. CLIENTES: Política Default Deny explícita
DROP POLICY IF EXISTS "clientes_default_deny" ON public.clientes;
CREATE POLICY "clientes_default_deny"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Remover e recriar políticas para ordem correta
DROP POLICY IF EXISTS "clientes_admin_view_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_sdr_own_only" ON public.clientes;
DROP POLICY IF EXISTS "clientes_user_assigned" ON public.clientes;
DROP POLICY IF EXISTS "clientes_admin_modify" ON public.clientes;

-- Política permissiva 1: Admins podem ver/modificar todos os clientes da empresa
CREATE POLICY "clientes_admin_full_access"
ON public.clientes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política permissiva 2: SDRs podem ver apenas clientes que criaram (SELECT apenas)
CREATE POLICY "clientes_sdr_read_own"
ON public.clientes  
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- 3. CONTATOS: Default Deny + Políticas explícitas
DROP POLICY IF EXISTS "contatos_default_deny" ON public.contatos;
CREATE POLICY "contatos_default_deny"
ON public.contatos
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Remover políticas existentes
DROP POLICY IF EXISTS "contatos_admin_view_all" ON public.contatos;
DROP POLICY IF EXISTS "contatos_manager_subordinates" ON public.contatos;
DROP POLICY IF EXISTS "contatos_user_assigned_only" ON public.contatos;
DROP POLICY IF EXISTS "contatos_admin_modify" ON public.contatos;

-- Política permissiva 1: Admins podem ver/modificar todos os contatos da empresa
CREATE POLICY "contatos_admin_full_access"
ON public.contatos
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política permissiva 2: Usuários podem ver apenas contatos atribuídos a eles
CREATE POLICY "contatos_user_assigned"
ON public.contatos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);

-- 4. EMPRESAS: Default Deny + Acesso restrito
DROP POLICY IF EXISTS "empresas_default_deny" ON public.empresas;
CREATE POLICY "empresas_default_deny"
ON public.empresas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Remover políticas existentes 
DROP POLICY IF EXISTS "Administradores podem gerenciar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users basic company info only" ON public.empresas;

-- Política permissiva: Apenas admins podem ver/modificar dados da empresa
CREATE POLICY "empresas_admin_only"
ON public.empresas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Política permissiva: Usuários podem ver dados básicos da sua empresa
CREATE POLICY "empresas_user_basic_info"
ON public.empresas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  id = get_user_active_company(auth.uid())
);

-- 5. PROFILES: Default Deny + Acesso ultra-restrito
DROP POLICY IF EXISTS "profiles_default_deny" ON public.profiles;
CREATE POLICY "profiles_default_deny"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Remover políticas existentes
DROP POLICY IF EXISTS "Administradores podem gerenciar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Sistema pode inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu perfil" ON public.profiles;
DROP POLICY IF EXISTS "Users own complete profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins basic profile info only" ON public.profiles;

-- Política permissiva 1: Usuários podem ver/editar apenas SEU próprio perfil
CREATE POLICY "profiles_own_only"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Política permissiva 2: Admins podem gerenciar todos os perfis
CREATE POLICY "profiles_admin_manage"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Política permissiva 3: Sistema pode inserir perfis (para novos usuários)
CREATE POLICY "profiles_system_insert"
ON public.profiles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. VENDAS: Default Deny + Políticas específicas
DROP POLICY IF EXISTS "vendas_default_deny" ON public.vendas;
CREATE POLICY "vendas_default_deny"
ON public.vendas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Remover políticas existentes
DROP POLICY IF EXISTS "Company admins only - all sales" ON public.vendas;
DROP POLICY IF EXISTS "Users own sales only" ON public.vendas;
DROP POLICY IF EXISTS "Company admins only - modify sales" ON public.vendas;

-- Política permissiva 1: Admins podem ver/modificar todas as vendas da empresa
CREATE POLICY "vendas_admin_full_access"
ON public.vendas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política permissiva 2: Vendedores podem ver apenas suas próprias vendas
CREATE POLICY "vendas_user_own_only"
ON public.vendas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND vendedor_id = auth.uid()
);
-- LIMPEZA COMPLETA E RECONSTRUÇÃO DE SEGURANÇA

-- 1. Forçar RLS em todas as tabelas (não pode ser desabilitado)
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contatos FORCE ROW LEVEL SECURITY; 
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendas FORCE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES

-- CLIENTES
DROP POLICY IF EXISTS "clientes_default_deny" ON public.clientes;
DROP POLICY IF EXISTS "clientes_admin_full_access" ON public.clientes;
DROP POLICY IF EXISTS "clientes_sdr_read_own" ON public.clientes;
DROP POLICY IF EXISTS "clientes_admin_view_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_sdr_own_only" ON public.clientes;
DROP POLICY IF EXISTS "clientes_user_assigned" ON public.clientes;
DROP POLICY IF EXISTS "clientes_admin_modify" ON public.clientes;

-- CONTATOS  
DROP POLICY IF EXISTS "contatos_default_deny" ON public.contatos;
DROP POLICY IF EXISTS "contatos_admin_full_access" ON public.contatos;
DROP POLICY IF EXISTS "contatos_user_assigned" ON public.contatos;
DROP POLICY IF EXISTS "contatos_admin_view_all" ON public.contatos;
DROP POLICY IF EXISTS "contatos_manager_subordinates" ON public.contatos;
DROP POLICY IF EXISTS "contatos_user_assigned_only" ON public.contatos;
DROP POLICY IF EXISTS "contatos_admin_modify" ON public.contatos;

-- EMPRESAS
DROP POLICY IF EXISTS "empresas_default_deny" ON public.empresas;
DROP POLICY IF EXISTS "empresas_admin_only" ON public.empresas;
DROP POLICY IF EXISTS "empresas_user_basic_info" ON public.empresas;
DROP POLICY IF EXISTS "Administradores podem gerenciar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users basic company info only" ON public.empresas;

-- PROFILES
DROP POLICY IF EXISTS "profiles_default_deny" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_system_insert" ON public.profiles;
DROP POLICY IF EXISTS "Administradores podem gerenciar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Sistema pode inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu perfil" ON public.profiles;
DROP POLICY IF EXISTS "Users own complete profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins basic profile info only" ON public.profiles;

-- VENDAS
DROP POLICY IF EXISTS "vendas_default_deny" ON public.vendas;
DROP POLICY IF EXISTS "vendas_admin_full_access" ON public.vendas;
DROP POLICY IF EXISTS "vendas_user_own_only" ON public.vendas;
DROP POLICY IF EXISTS "Company admins only - all sales" ON public.vendas;
DROP POLICY IF EXISTS "Users own sales only" ON public.vendas;
DROP POLICY IF EXISTS "Company admins only - modify sales" ON public.vendas;

-- 3. RECRIAR POLÍTICAS COM ESTRATÉGIA DEFAULT DENY

-- =================== CLIENTES ===================
-- Default Deny: Ninguém pode acessar por padrão
CREATE POLICY "deny_all_clientes"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Permite: Apenas admins/gerentes da MESMA empresa podem ver/modificar
CREATE POLICY "allow_admin_clientes"
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

-- Permite: SDRs podem ver APENAS clientes que criaram (READ-ONLY)
CREATE POLICY "allow_sdr_own_clientes"
ON public.clientes  
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- =================== CONTATOS ===================
-- Default Deny: Ninguém pode acessar por padrão
CREATE POLICY "deny_all_contatos"
ON public.contatos
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Permite: Admins/gerentes da MESMA empresa podem ver/modificar todos
CREATE POLICY "allow_admin_contatos"
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

-- Permite: Usuários podem ver APENAS contatos atribuídos diretamente a eles
CREATE POLICY "allow_assigned_contatos"
ON public.contatos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);

-- =================== EMPRESAS ===================
-- Default Deny: Ninguém pode acessar por padrão
CREATE POLICY "deny_all_empresas"
ON public.empresas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Permite: Apenas administradores podem ver/modificar dados da empresa
CREATE POLICY "allow_admin_empresas"
ON public.empresas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Permite: Usuários podem ver dados básicos da SUA empresa ativa
CREATE POLICY "allow_own_empresa_basic"
ON public.empresas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = get_user_active_company(auth.uid()));

-- =================== PROFILES ===================
-- Default Deny: Ninguém pode acessar por padrão
CREATE POLICY "deny_all_profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Permite: Usuários podem ver/editar APENAS seu próprio perfil
CREATE POLICY "allow_own_profile"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Permite: Administradores podem gerenciar todos os perfis
CREATE POLICY "allow_admin_profiles"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Permite: Sistema pode inserir novos perfis (signup)
CREATE POLICY "allow_system_insert_profiles"
ON public.profiles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =================== VENDAS ===================
-- Default Deny: Ninguém pode acessar por padrão
CREATE POLICY "deny_all_vendas"
ON public.vendas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Permite: Admins/gerentes da MESMA empresa podem ver/modificar todas as vendas
CREATE POLICY "allow_admin_vendas"
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

-- Permite: Vendedores podem ver APENAS suas próprias vendas
CREATE POLICY "allow_own_vendas"
ON public.vendas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND vendedor_id = auth.uid()
);
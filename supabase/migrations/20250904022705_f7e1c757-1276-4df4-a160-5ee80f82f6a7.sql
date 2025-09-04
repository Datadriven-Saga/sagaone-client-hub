-- ÚLTIMA LIMPEZA E CRIAÇÃO APENAS DAS POLÍTICAS CRÍTICAS

-- Remover manualmente as políticas que ainda existem
DROP POLICY IF EXISTS "clientes_deny_all_by_default" ON public.clientes;
DROP POLICY IF EXISTS "contatos_deny_all_by_default" ON public.contatos;
DROP POLICY IF EXISTS "empresas_deny_all_by_default" ON public.empresas;
DROP POLICY IF EXISTS "profiles_deny_all_by_default" ON public.profiles;
DROP POLICY IF EXISTS "vendas_deny_all_by_default" ON public.vendas;

-- CRIAR APENAS POLÍTICAS PARA AS TABELAS MAIS CRÍTICAS

-- =================== CLIENTES ===================
-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "rls_clientes_default_deny"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política permissiva: Admins/gerentes da mesma empresa
CREATE POLICY "rls_clientes_admin_access"
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

-- Política permissiva: SDRs podem ver apenas clientes que criaram
CREATE POLICY "rls_clientes_sdr_readonly"
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
-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "rls_contatos_default_deny"
ON public.contatos
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política permissiva: Admins/gerentes da mesma empresa
CREATE POLICY "rls_contatos_admin_access"
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

-- Política permissiva: Usuários podem ver apenas contatos atribuídos
CREATE POLICY "rls_contatos_user_assigned"
ON public.contatos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);

-- =================== EMPRESAS ===================
-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "rls_empresas_default_deny"
ON public.empresas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política permissiva: Apenas admins podem gerenciar empresas
CREATE POLICY "rls_empresas_admin_manage"
ON public.empresas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Política permissiva: Usuários podem ver sua empresa ativa
CREATE POLICY "rls_empresas_user_readonly"
ON public.empresas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = get_user_active_company(auth.uid()));

-- =================== PROFILES ===================
-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "rls_profiles_default_deny"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política permissiva: Usuários podem ver/editar apenas seu perfil
CREATE POLICY "rls_profiles_own_access"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Política permissiva: Admins podem gerenciar todos os perfis
CREATE POLICY "rls_profiles_admin_manage"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Política permissiva: Sistema pode inserir perfis
CREATE POLICY "rls_profiles_system_insert"
ON public.profiles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);
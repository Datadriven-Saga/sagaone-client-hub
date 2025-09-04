-- Limpar e recriar políticas corretas para contatos
-- Remover todas as políticas existentes para começar limpo
DROP POLICY IF EXISTS "rls_contatos_default_deny" ON public.contatos;
DROP POLICY IF EXISTS "rls_contatos_admin_access" ON public.contatos;
DROP POLICY IF EXISTS "rls_contatos_user_assigned" ON public.contatos;
DROP POLICY IF EXISTS "rls_contatos_sdr_insert" ON public.contatos;
DROP POLICY IF EXISTS "rls_contatos_sdr_update_assigned" ON public.contatos;
DROP POLICY IF EXISTS "contatos_admins_same_company_full" ON public.contatos;
DROP POLICY IF EXISTS "contatos_user_assigned_only_readonly" ON public.contatos;

-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "rls_contatos_default_deny"
ON public.contatos
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política permissiva: Admins/gerentes da mesma empresa podem fazer tudo
CREATE POLICY "rls_contatos_admin_full_access"
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

-- Política permissiva: SDRs podem inserir contatos em sua empresa
CREATE POLICY "rls_contatos_sdr_insert_company"
ON public.contatos
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
);

-- Política permissiva: Usuários podem ver contatos atribuídos a eles
CREATE POLICY "rls_contatos_user_assigned_read"
ON public.contatos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);

-- Política permissiva: Usuários podem atualizar contatos atribuídos a eles
CREATE POLICY "rls_contatos_user_assigned_update"
ON public.contatos
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);
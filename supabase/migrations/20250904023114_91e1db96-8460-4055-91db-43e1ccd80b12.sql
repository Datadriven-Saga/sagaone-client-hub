-- Corrigir políticas RLS para permitir inserção de contatos
-- Permitir que usuários autenticados insiram contatos em sua empresa

-- Atualizar política de contatos para permitir INSERT
DROP POLICY IF EXISTS "rls_contatos_admin_access" ON public.contatos;

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

-- Política para permitir que SDRs insiram contatos em sua empresa
CREATE POLICY "rls_contatos_sdr_insert"
ON public.contatos
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
);

-- Política para permitir UPDATE de contatos para SDRs quando são responsáveis
CREATE POLICY "rls_contatos_sdr_update_assigned"
ON public.contatos
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND responsavel_email = get_current_user_email()
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND responsavel_email = get_current_user_email()
);
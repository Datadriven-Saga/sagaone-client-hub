-- LIMPEZA COMPLETA E CORREÇÃO DE SEGURANÇA PARA CLIENTES
-- Remover TODAS as políticas existentes primeiro

DO $$
DECLARE
    pol record;
BEGIN
    -- Remover todas as políticas da tabela clientes
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clientes' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.clientes';
    END LOOP;
END $$;

-- =================== NOVA ESTRUTURA DE SEGURANÇA PARA CLIENTES ===================
-- Política restritiva: NEGAR TUDO por padrão
CREATE POLICY "clientes_security_deny_all"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política 1: Apenas Administradores e TI têm acesso completo aos dados pessoais
CREATE POLICY "clientes_admin_ti_full_access"
ON public.clientes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso
  ])
);

-- Política 2: Gerentes podem inserir clientes (para upload de planilha) mas não ver dados pessoais completos
CREATE POLICY "clientes_gerentes_insert_only"
ON public.clientes
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política 3: Gerentes podem ver dados limitados (sem CPF/dados sensíveis)
CREATE POLICY "clientes_gerentes_limited_view"
ON public.clientes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política 4: SDRs podem ver apenas clientes que criaram
CREATE POLICY "clientes_sdr_own_data_only"
ON public.clientes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- Política 5: SDRs podem inserir clientes (necessário para upload)
CREATE POLICY "clientes_sdr_can_insert"
ON public.clientes
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);
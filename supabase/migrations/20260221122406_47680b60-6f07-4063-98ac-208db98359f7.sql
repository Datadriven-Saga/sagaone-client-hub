
-- 1. Add Recepcionista to the contatos full access policy
DROP POLICY IF EXISTS "contatos_managers_full_access" ON public.contatos;
CREATE POLICY "contatos_managers_full_access" ON public.contatos
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY (ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso,
    'Master'::tipo_acesso,
    'CRM'::tipo_acesso,
    'Recepcionista'::tipo_acesso
  ])
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY (ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso,
    'Master'::tipo_acesso,
    'CRM'::tipo_acesso,
    'Recepcionista'::tipo_acesso
  ])
);

-- 2. Add INSERT policy for logs_movimentacao_contatos (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'logs_movimentacao_contatos' AND policyname = 'logs_movimentacao_insert_authenticated'
  ) THEN
    CREATE POLICY "logs_movimentacao_insert_authenticated" ON public.logs_movimentacao_contatos
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 3. Add INSERT policy for eventos_prospeccao (missing for check-in flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'eventos_prospeccao' AND policyname = 'eventos_prospeccao_insert_authenticated'
  ) THEN
    CREATE POLICY "eventos_prospeccao_insert_authenticated" ON public.eventos_prospeccao
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

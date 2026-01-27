-- =====================================================
-- SECURITY FIX: Restrict contatos and clientes access
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "contatos_empresa_users_all" ON public.contatos;
DROP POLICY IF EXISTS "clientes_users_own_clients" ON public.clientes;

-- =====================================================
-- CONTATOS: Role-based access control
-- =====================================================

-- Managers (Admin, TI, Diretor, Gerente de Leads, Gerente de Loja) have full access
CREATE POLICY "contatos_managers_full_access"
ON public.contatos
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Regular users can only SELECT contacts they are responsible for
CREATE POLICY "contatos_users_select_own"
ON public.contatos
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    -- User is the responsible (by email)
    responsavel_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    -- Or user is assigned as vendedor
    OR vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
  )
);

-- Regular users can INSERT contacts (they become responsible)
CREATE POLICY "contatos_users_insert"
ON public.contatos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Regular users can UPDATE only their own contacts
CREATE POLICY "contatos_users_update_own"
ON public.contatos
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    responsavel_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);

-- =====================================================
-- CLIENTES: Strengthen access control
-- =====================================================

-- Recreate users policy with stricter validation
-- Users can only access clients they directly own or are assigned to via contatos
CREATE POLICY "clientes_users_own_only"
ON public.clientes
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    -- User directly owns the client
    user_id = auth.uid()
    -- Or user is explicitly assigned as responsible in contatos
    OR id IN (
      SELECT DISTINCT c.cliente_id 
      FROM public.contatos c 
      WHERE c.cliente_id IS NOT NULL
      AND c.empresa_id = get_user_active_company(auth.uid())
      AND (
        c.responsavel_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR c.vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
      )
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);
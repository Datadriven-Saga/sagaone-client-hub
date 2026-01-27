-- =====================================================
-- FIX: Replace auth.users references with security definer function
-- The RLS policies were trying to access auth.users directly which is not allowed
-- =====================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "contatos_users_select_own" ON public.contatos;
DROP POLICY IF EXISTS "contatos_users_update_own" ON public.contatos;
DROP POLICY IF EXISTS "clientes_users_own_only" ON public.clientes;

-- =====================================================
-- CONTATOS: Fixed policies using security definer function
-- =====================================================

-- Regular users can only SELECT contacts they are responsible for
CREATE POLICY "contatos_users_select_own"
ON public.contatos
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    -- User is the responsible (using security definer function)
    responsavel_email = get_current_user_email()
    -- Or user is assigned as vendedor
    OR vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
  )
);

-- Regular users can UPDATE only their own contacts
CREATE POLICY "contatos_users_update_own"
ON public.contatos
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    responsavel_email = get_current_user_email()
    OR vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);

-- =====================================================
-- CLIENTES: Fixed policy using security definer function
-- =====================================================

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
        c.responsavel_email = get_current_user_email()
        OR c.vendedor_nome = (SELECT nome_completo FROM public.profiles WHERE id = auth.uid())
      )
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);
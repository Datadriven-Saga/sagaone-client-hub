-- Fix 1: Profiles - Restrict same-company viewing to managers only
-- Regular users should only see their own profile
-- Create a security definer function for listing company users (for dropdowns)

-- Drop the overly permissive same-company view policy
DROP POLICY IF EXISTS "profiles_same_company_view" ON public.profiles;

-- Create a new policy that only allows managers to view other profiles
CREATE POLICY "profiles_managers_view_company" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can always see their own profile
    id = auth.uid()
    -- Admins can see all
    OR is_admin()
    -- Managers can view profiles in their company
    OR (
      empresa_id = get_user_active_company(auth.uid())
      AND get_current_user_access_type() IN (
        'Diretor'::tipo_acesso,
        'TI'::tipo_acesso,
        'Gerente de Leads'::tipo_acesso,
        'Gerente de Loja'::tipo_acesso
      )
    )
  );

-- Create a security definer function for getting company users (for dropdowns)
-- This returns only non-sensitive fields needed for UI components
CREATE OR REPLACE FUNCTION public.get_company_users_for_selection(company_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  nome_completo text,
  tipo_acesso tipo_acesso,
  departamento text,
  status status_usuario
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome_completo,
    p.tipo_acesso,
    p.departamento,
    p.status
  FROM public.profiles p
  WHERE p.empresa_id = COALESCE(company_id, get_user_active_company(auth.uid()))
  AND p.status = 'Ativo'::status_usuario
  ORDER BY p.nome_completo;
$$;

-- Fix 2: Clientes - The policies are already restrictive but let's verify
-- by ensuring the clientes_users_own_clients policy properly restricts access

-- Drop and recreate clientes policies with clearer restrictions
DROP POLICY IF EXISTS "clientes_managers_full_access" ON public.clientes;
DROP POLICY IF EXISTS "clientes_users_own_clients" ON public.clientes;

-- Policy for managers - full access to company clients (business requirement)
CREATE POLICY "clientes_managers_full_access" ON public.clientes
  FOR ALL
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    AND get_current_user_access_type() IN (
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    )
  )
  WITH CHECK (
    empresa_id = get_user_active_company(auth.uid())
    AND get_current_user_access_type() IN (
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    )
  );

-- Policy for regular users - ONLY their assigned clients
CREATE POLICY "clientes_users_own_clients" ON public.clientes
  FOR ALL
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    AND (
      -- User owns the client
      user_id = auth.uid()
      -- OR user is responsible for a contact linked to this client
      OR id IN (
        SELECT DISTINCT contatos.cliente_id 
        FROM public.contatos 
        WHERE contatos.responsavel_email = auth.uid()::text
        AND contatos.cliente_id IS NOT NULL
        AND contatos.empresa_id = get_user_active_company(auth.uid())
      )
    )
  )
  WITH CHECK (
    empresa_id = get_user_active_company(auth.uid())
  );
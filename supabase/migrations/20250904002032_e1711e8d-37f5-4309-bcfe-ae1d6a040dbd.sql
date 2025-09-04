-- Fix security issue: Restrict client data access based on user roles and ownership

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can manage clients from their active company" ON public.clientes;

-- Create granular policies based on user roles and ownership

-- 1. Administrators and managers can access all clients in their company
CREATE POLICY "Administrators and managers can access all company clients"
ON public.clientes
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company() 
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company()
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 2. Regular users (SDR, Vendedor, etc.) can only access clients they own or are assigned to
CREATE POLICY "Users can access their assigned clients"
ON public.clientes  
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company()
  AND (
    user_id = auth.uid() -- Clients they created/own
    OR id IN ( -- Clients linked to contacts they're responsible for
      SELECT DISTINCT c.cliente_id 
      FROM public.contatos c 
      WHERE c.responsavel_id = auth.uid() 
      AND c.cliente_id IS NOT NULL
      AND c.empresa_id = get_user_active_company()
    )
  )
)
WITH CHECK (
  empresa_id = get_user_active_company()
  AND (
    user_id = auth.uid() -- Can only create clients assigned to themselves
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso,
      'TI'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
);

-- 3. Add a function to help with client assignment queries (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_accessible_clients(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(cliente_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Get user's access type and company
  WITH user_info AS (
    SELECT 
      p.tipo_acesso,
      get_user_active_company(user_id_param) as empresa_id
    FROM public.profiles p 
    WHERE p.id = user_id_param
  )
  SELECT c.id as cliente_id
  FROM public.clientes c
  CROSS JOIN user_info ui
  WHERE c.empresa_id = ui.empresa_id
  AND (
    -- Administrators, TI, Directors and Managers can access all company clients
    ui.tipo_acesso = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
    OR
    -- Regular users can only access clients they own or are responsible for via contacts
    (
      c.user_id = user_id_param
      OR c.id IN (
        SELECT DISTINCT cont.cliente_id 
        FROM public.contatos cont 
        WHERE cont.responsavel_id = user_id_param 
        AND cont.cliente_id IS NOT NULL
        AND cont.empresa_id = ui.empresa_id
      )
    )
  );
$$;
-- Fix security issue: Remove all existing policies and create correct ones
-- Drop ALL existing policies on the clientes table
DROP POLICY IF EXISTS "Administrators and managers can access all company clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can access their assigned clients" ON public.clientes;
DROP POLICY IF EXISTS "Administrators can access all company clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can manage clients from their active company" ON public.clientes;
DROP FUNCTION IF EXISTS public.get_user_accessible_clients(uuid);

-- Create new policies with correct access types
-- 1. Policy for administrators and managers (full access)
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

-- 2. Policy for regular users (limited access)
CREATE POLICY "Users can access their assigned clients"
ON public.clientes  
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company()
  AND (
    user_id = auth.uid()
    OR id IN (
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
    user_id = auth.uid()
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso,
      'TI'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
);

-- 3. Helper function for client access queries
CREATE OR REPLACE FUNCTION public.get_user_accessible_clients(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(cliente_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    ui.tipo_acesso = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
    OR
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
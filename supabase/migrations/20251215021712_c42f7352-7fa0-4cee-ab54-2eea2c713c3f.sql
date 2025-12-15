-- Drop existing policy
DROP POLICY IF EXISTS "clientes_empresa_users_all" ON public.clientes;

-- Policy for managers/admins - full access to all company clients
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

-- Policy for regular users (Vendedor, SDR, etc.) - only their own clients
CREATE POLICY "clientes_users_own_clients" ON public.clientes
  FOR ALL
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    AND (
      user_id = auth.uid()
      OR id IN (
        SELECT DISTINCT cliente_id 
        FROM public.contatos 
        WHERE responsavel_email = auth.uid()::text
        AND cliente_id IS NOT NULL
      )
    )
  )
  WITH CHECK (
    empresa_id = get_user_active_company(auth.uid())
  );
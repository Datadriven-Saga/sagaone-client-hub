-- Implement security triggers and hardened RLS policies

-- 1. Create trigger to prevent privilege escalation in profiles
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only admins can modify sensitive fields
  IF NOT is_admin() THEN
    -- Prevent changes to sensitive fields for non-admins
    IF OLD.tipo_acesso IS DISTINCT FROM NEW.tipo_acesso THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar tipo de acesso';
    END IF;
    
    IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar empresa associada';
    END IF;
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar status do usuário';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS prevent_privilege_escalation_profiles_trigger ON public.profiles;
CREATE TRIGGER prevent_privilege_escalation_profiles_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation_profiles();

-- 2. Create trigger to prevent company hopping in user_empresas
CREATE OR REPLACE FUNCTION public.prevent_company_hopping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only admins can modify user_id and empresa_id
  IF NOT is_admin() THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar associação de usuário';
    END IF;
    
    IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar associação de empresa';
    END IF;
    
    -- Non-admins can only change is_ativa for their own records
    IF NEW.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Usuários só podem alterar suas próprias empresas ativas';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_empresas table
DROP TRIGGER IF EXISTS prevent_company_hopping_trigger ON public.user_empresas;
CREATE TRIGGER prevent_company_hopping_trigger
  BEFORE UPDATE ON public.user_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_company_hopping();

-- 3. Harden RLS policies for contatos table
-- Drop existing policies and create stricter ones
DROP POLICY IF EXISTS "Users can manage contacts from their active company" ON public.contatos;

-- Administrators and managers can access all company contacts
CREATE POLICY "Administrators and managers can access all company contacts"
ON public.contatos
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

-- Regular users can only access contacts they are responsible for
CREATE POLICY "Users can access their assigned contacts"
ON public.contatos
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company()
  AND responsavel_id = auth.uid()
)
WITH CHECK (
  empresa_id = get_user_active_company()
  AND (
    responsavel_id = auth.uid()
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso,
      'TI'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
);

-- 4. Harden RLS policies for vendas table
-- Drop existing policies and create stricter ones
DROP POLICY IF EXISTS "Users can manage sales from their active company" ON public.vendas;

-- Administrators and managers can access all company sales
CREATE POLICY "Administrators and managers can access all company sales"
ON public.vendas
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

-- Regular users can only access sales they made
CREATE POLICY "Users can access their own sales"
ON public.vendas
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company()
  AND vendedor_id = auth.uid()
)
WITH CHECK (
  empresa_id = get_user_active_company()
  AND (
    vendedor_id = auth.uid()
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso,
      'TI'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
);
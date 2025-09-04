-- Criar uma função mais simples para verificar admin que evita problemas de RLS
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_id_param UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = user_id_param 
        AND tipo_acesso = 'Administrador'::tipo_acesso
      ) THEN true
      ELSE false
    END;
$$;

-- Simplificar as políticas RLS da tabela profiles
DROP POLICY IF EXISTS "profiles_users_own_only_full" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admins_manage_all" ON public.profiles;
DROP POLICY IF EXISTS "rls_profiles_own_access" ON public.profiles;
DROP POLICY IF EXISTS "rls_profiles_admin_manage" ON public.profiles;
DROP POLICY IF EXISTS "rls_profiles_default_deny" ON public.profiles;

-- Criar políticas mais simples e claras
CREATE POLICY "profiles_own_access"
ON public.profiles
FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_full_access"
ON public.profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.id = auth.uid() 
    AND p2.tipo_acesso = 'Administrador'::tipo_acesso
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.id = auth.uid() 
    AND p2.tipo_acesso = 'Administrador'::tipo_acesso
  )
);
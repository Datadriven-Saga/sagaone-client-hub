-- Corrigir o problema de recursão infinita criando função security definer
DROP POLICY IF EXISTS "profiles_admin_full_access" ON public.profiles;

-- Atualizar a função is_admin para usar security definer adequadamente
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND tipo_acesso = 'Administrador'::tipo_acesso
  );
$$;

-- Criar política administrativa que usa a função security definer
CREATE POLICY "profiles_admin_full_access"
ON public.profiles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
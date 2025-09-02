-- Corrigir as funções para ter o search_path correto
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND tipo_acesso = 'Administrador'::tipo_acesso
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_access_type()
RETURNS tipo_acesso
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tipo_acesso 
  FROM public.profiles 
  WHERE id = auth.uid();
$$;
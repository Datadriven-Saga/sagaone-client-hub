-- Fix: Gestores não conseguem ver profiles porque empresa_id é NULL na maioria dos profiles.
-- A verificação deve usar user_empresas para checar se o profile pertence à mesma empresa.

-- Primeiro criar função security definer para checar se um user pertence a uma empresa via user_empresas
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_empresas
    WHERE user_id = _user_id
      AND empresa_id = _empresa_id
  );
$$;

-- Atualizar policy para usar user_empresas ao invés de profiles.empresa_id
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  (id = auth.uid())
  OR is_admin()
  OR (
    get_current_user_access_type() IN ('TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'CRM'::tipo_acesso, 'Diretor'::tipo_acesso, 'Proprietário'::tipo_acesso)
    AND user_belongs_to_company(id, get_user_active_company(auth.uid()))
  )
);
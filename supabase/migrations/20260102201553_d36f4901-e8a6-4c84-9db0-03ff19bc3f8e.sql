-- Remove a política de SELECT muito permissiva
DROP POLICY IF EXISTS "profiles_select_restricted" ON public.profiles;

-- Criar política mais restritiva: apenas o próprio usuário, admins e TI podem ver dados completos
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING (
  (id = auth.uid())  -- Próprio perfil
  OR is_admin()      -- Administradores
  OR (
    get_current_user_access_type() = 'TI'::tipo_acesso 
    AND empresa_id = get_user_active_company(auth.uid())
  )
);

-- Adicionar comentário explicando que gerentes devem usar profiles_safe
COMMENT ON TABLE public.profiles IS 'Dados de perfil dos usuários. ATENÇÃO: Para listar colegas da empresa, use a view profiles_safe que mascara dados sensíveis (CPF, celular).';
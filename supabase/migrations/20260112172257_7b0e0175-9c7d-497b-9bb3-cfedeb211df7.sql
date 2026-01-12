-- Primeiro, criar uma função helper para verificar acesso à empresa
CREATE OR REPLACE FUNCTION public.user_can_access_empresa(target_empresa_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Verifica se é a empresa ativa do usuário
    SELECT 1 WHERE target_empresa_id = get_user_active_company(user_id)
    UNION ALL
    -- Verifica se o usuário tem acesso via user_empresas
    SELECT 1 FROM public.user_empresas ue 
    WHERE ue.user_id = user_can_access_empresa.user_id 
    AND ue.empresa_id = target_empresa_id
    UNION ALL
    -- Verifica se é a empresa do perfil do usuário
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_can_access_empresa.user_id 
    AND p.empresa_id = target_empresa_id
  );
$$;

-- Dropar a política antiga
DROP POLICY IF EXISTS "prospeccoes_empresa_users_all" ON public.prospeccoes;

-- Criar políticas separadas para melhor controle

-- Política de SELECT - usuários veem prospecções da empresa ativa
CREATE POLICY "prospeccoes_select" ON public.prospeccoes
FOR SELECT TO authenticated
USING (public.user_can_access_empresa(empresa_id));

-- Política de INSERT - usuários podem inserir na empresa que têm acesso
CREATE POLICY "prospeccoes_insert" ON public.prospeccoes
FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_empresa(empresa_id));

-- Política de UPDATE - usuários podem atualizar prospecções da empresa que têm acesso
CREATE POLICY "prospeccoes_update" ON public.prospeccoes
FOR UPDATE TO authenticated
USING (public.user_can_access_empresa(empresa_id))
WITH CHECK (public.user_can_access_empresa(empresa_id));

-- Política de DELETE - usuários podem deletar prospecções da empresa que têm acesso
CREATE POLICY "prospeccoes_delete" ON public.prospeccoes
FOR DELETE TO authenticated
USING (public.user_can_access_empresa(empresa_id));
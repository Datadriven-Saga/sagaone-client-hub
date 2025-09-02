-- Remover as políticas problemáticas
DROP POLICY IF EXISTS "Administradores podem gerenciar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON public.profiles;

-- Criar função security definer para verificar se o usuário é administrador
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

-- Criar função security definer para obter o tipo de acesso do usuário atual
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

-- Recriar as políticas usando as funções security definer
CREATE POLICY "Administradores podem ver todos os perfis"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Administradores podem gerenciar perfis"
  ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Adicionar política para inserção de novos perfis (para o trigger handle_new_user)
CREATE POLICY "Sistema pode inserir perfis"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Adicionar política para usuários atualizarem seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu perfil"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
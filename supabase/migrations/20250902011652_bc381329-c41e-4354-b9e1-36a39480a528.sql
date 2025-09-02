-- Corrigir o trigger handle_new_user para não sobrescrever o nome com email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$;

-- Restaurar as políticas de segurança adequadas
DROP POLICY IF EXISTS "Acesso público temporário para empresas" ON public.empresas;
DROP POLICY IF EXISTS "Acesso público temporário para perfis" ON public.profiles;

-- Políticas para empresas
CREATE POLICY "Administradores podem ver todas as empresas"
  ON public.empresas
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Administradores podem gerenciar empresas"
  ON public.empresas
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para profiles
CREATE POLICY "Administradores podem ver todos os perfis"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Administradores podem gerenciar perfis"
  ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Sistema pode inserir perfis"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar seu perfil"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);
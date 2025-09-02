-- Remover todas as políticas existentes primeiro
DROP POLICY IF EXISTS "Acesso público temporário para empresas" ON public.empresas;
DROP POLICY IF EXISTS "Acesso público temporário para perfis" ON public.profiles;
DROP POLICY IF EXISTS "Sistema pode inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;

-- Restaurar as políticas de segurança adequadas para empresas
CREATE POLICY "Administradores podem ver todas as empresas"
  ON public.empresas
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Administradores podem gerenciar empresas"
  ON public.empresas
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Restaurar as políticas de segurança adequadas para profiles
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
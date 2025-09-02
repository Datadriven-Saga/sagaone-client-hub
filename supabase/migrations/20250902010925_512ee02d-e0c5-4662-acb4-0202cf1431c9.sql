-- Criar política temporária para permitir acesso público às empresas (apenas para configuração inicial)
DROP POLICY IF EXISTS "Administradores podem ver todas as empresas" ON public.empresas;
DROP POLICY IF EXISTS "Administradores podem gerenciar empresas" ON public.empresas;

-- Política temporária para permitir acesso completo (será removida após configuração)
CREATE POLICY "Acesso público temporário para empresas"
  ON public.empresas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Política temporária para permitir criação de perfis iniciais
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Administradores podem gerenciar perfis" ON public.profiles;

CREATE POLICY "Acesso público temporário para perfis"
  ON public.profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);
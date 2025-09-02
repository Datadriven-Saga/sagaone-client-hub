-- Corrigir as políticas RLS da tabela empresas para usar as funções security definer
DROP POLICY IF EXISTS "Administradores podem gerenciar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Administradores podem ver todas as empresas" ON public.empresas;

-- Recriar as políticas usando a função is_admin()
CREATE POLICY "Administradores podem ver todas as empresas"
  ON public.empresas
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Administradores podem gerenciar empresas"
  ON public.empresas
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
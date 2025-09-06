-- Criar tabela para relacionar proprietários com empresas
CREATE TABLE IF NOT EXISTS public.proprietario_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proprietario_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.proprietario_empresas ENABLE ROW LEVEL SECURITY;

-- Política para administradores e TI terem acesso total
CREATE POLICY "proprietario_empresas_admins_full_access" 
ON public.proprietario_empresas 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Política para proprietários verem suas próprias empresas
CREATE POLICY "proprietario_empresas_view_own" 
ON public.proprietario_empresas 
FOR SELECT 
USING (proprietario_id = auth.uid());

-- Função para verificar se um usuário é proprietário de uma empresa
CREATE OR REPLACE FUNCTION public.is_company_owner(company_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proprietario_empresas pe
    WHERE pe.empresa_id = company_id 
    AND pe.proprietario_id = user_id
  );
$$;

-- Função para obter empresas de um proprietário
CREATE OR REPLACE FUNCTION public.get_owned_companies(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(empresa_id UUID)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pe.empresa_id
  FROM public.proprietario_empresas pe
  WHERE pe.proprietario_id = user_id;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_proprietario_empresas_updated_at
  BEFORE UPDATE ON public.proprietario_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
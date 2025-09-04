-- Habilitar RLS nas tabelas contatos e prospeccoes
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tabela contatos
CREATE POLICY "contatos_empresa_users_all" 
ON public.contatos 
FOR ALL 
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para tabela prospeccoes  
CREATE POLICY "prospeccoes_empresa_users_all"
ON public.prospeccoes
FOR ALL 
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Garantir que empresa_id seja definido automaticamente nas inserções
CREATE TRIGGER set_contatos_empresa_id
  BEFORE INSERT ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_prospeccoes_empresa_id
  BEFORE INSERT ON public.prospeccoes  
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

-- Garantir updated_at seja atualizado automaticamente
CREATE TRIGGER update_contatos_updated_at
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospeccoes_updated_at
  BEFORE UPDATE ON public.prospeccoes
  FOR EACH ROW  
  EXECUTE FUNCTION public.update_updated_at_column();
-- Criar nova tabela prospect independente
CREATE TABLE public.prospect (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'Novo',
  origem TEXT DEFAULT 'Outros',
  valor_potencial NUMERIC,
  observacoes TEXT,
  responsavel_id UUID,
  responsavel_email TEXT,
  cliente_id UUID,
  empresa_id UUID NOT NULL,
  user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.prospect ENABLE ROW LEVEL SECURITY;

-- Política para empresa ativa do usuário
CREATE POLICY "prospect_empresa_users_all" 
ON public.prospect 
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_prospect_updated_at
BEFORE UPDATE ON public.prospect
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para definir empresa_id automaticamente
CREATE TRIGGER set_prospect_empresa_id
BEFORE INSERT ON public.prospect
FOR EACH ROW
EXECUTE FUNCTION public.set_empresa_id_on_insert();
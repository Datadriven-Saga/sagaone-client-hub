-- Criar tabela para controle de recepção de visitas
CREATE TABLE public.recepcao_visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT NOT NULL,
  nome_campanha TEXT NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_hora_visita TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recepcao_visitas ENABLE ROW LEVEL SECURITY;

-- Política para usuários da empresa
CREATE POLICY "recepcao_visitas_empresa_users_all" 
ON public.recepcao_visitas 
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_recepcao_visitas_updated_at
BEFORE UPDATE ON public.recepcao_visitas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
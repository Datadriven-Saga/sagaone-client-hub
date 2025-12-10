-- Create vendas_prospeccao table for tracking sales from prospecting
CREATE TABLE public.vendas_prospeccao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  numero_venda INTEGER NOT NULL,
  contato_id UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  responsavel_id UUID REFERENCES public.profiles(id),
  produto_id UUID REFERENCES public.produtos(id),
  departamento_id UUID REFERENCES public.departamentos(id),
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_venda NUMERIC,
  comprovante_url TEXT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on (prospeccao_id, numero_venda) to ensure unique sale numbers per prospection
CREATE UNIQUE INDEX vendas_prospeccao_numero_unique ON public.vendas_prospeccao(prospeccao_id, numero_venda);

-- Create unique constraint on contato_id to ensure one sale per lead
CREATE UNIQUE INDEX vendas_prospeccao_contato_unique ON public.vendas_prospeccao(contato_id);

-- Create index for faster queries
CREATE INDEX vendas_prospeccao_prospeccao_id_idx ON public.vendas_prospeccao(prospeccao_id);
CREATE INDEX vendas_prospeccao_empresa_id_idx ON public.vendas_prospeccao(empresa_id);

-- Enable RLS
ALTER TABLE public.vendas_prospeccao ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company users
CREATE POLICY "vendas_prospeccao_empresa_users_all" 
ON public.vendas_prospeccao 
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_vendas_prospeccao_updated_at
BEFORE UPDATE ON public.vendas_prospeccao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get next sale number for a prospection
CREATE OR REPLACE FUNCTION public.get_next_venda_numero(p_prospeccao_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(numero_venda), 0) + 1
  FROM public.vendas_prospeccao
  WHERE prospeccao_id = p_prospeccao_id;
$$;
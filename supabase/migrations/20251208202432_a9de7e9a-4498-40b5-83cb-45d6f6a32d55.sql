-- Tabela para armazenar premiações personalizadas de prospecções
CREATE TABLE public.prospeccao_outras_premiacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospeccao_outras_premiacoes ENABLE ROW LEVEL SECURITY;

-- Create policy for company users
CREATE POLICY "prospeccao_outras_premiacoes_empresa_users_all"
ON public.prospeccao_outras_premiacoes
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));
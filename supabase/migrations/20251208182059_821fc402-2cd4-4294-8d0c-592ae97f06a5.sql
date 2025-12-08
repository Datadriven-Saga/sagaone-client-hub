-- Create table for marketing assets
CREATE TABLE public.prospeccao_marketing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_formato TEXT NOT NULL, -- 'stories', 'feed_quadrado', 'feed_retrato', 'feed_paisagem', 'reels'
  plataforma TEXT NOT NULL, -- 'instagram', 'facebook', 'tiktok', 'todos'
  largura INTEGER NOT NULL,
  altura INTEGER NOT NULL,
  imagem_url TEXT,
  nome_arquivo TEXT,
  tamanho_arquivo INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospeccao_marketing ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "prospeccao_marketing_empresa_users_all" 
ON public.prospeccao_marketing 
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_prospeccao_marketing_updated_at
BEFORE UPDATE ON public.prospeccao_marketing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
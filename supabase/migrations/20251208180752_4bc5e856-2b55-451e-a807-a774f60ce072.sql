-- Criar tabela para configuração de páginas de captura
CREATE TABLE public.prospeccao_paginas (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prospeccao_id uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE UNIQUE,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    inicio_frase text,
    palavra_destaque text,
    final_frase text,
    texto_apoio text,
    primeiro_dia_evento date,
    dia_final_evento date,
    hora_inicio time without time zone,
    hora_termino time without time zone,
    link_politica_privacidade text,
    cor_fundo text DEFAULT '#0d2b47',
    cor_texto text DEFAULT '#ffffff',
    cor_destaque text DEFAULT '#0ab9d8',
    imagem_evento_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospeccao_paginas ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "prospeccao_paginas_empresa_users_all"
ON public.prospeccao_paginas
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_prospeccao_paginas_updated_at
BEFORE UPDATE ON public.prospeccao_paginas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
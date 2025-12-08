-- Criar tabela para metas individuais por usuário e prospecção
CREATE TABLE public.prospeccao_metas_individuais (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prospeccao_id uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    meta_vendas integer DEFAULT 0,
    meta_checkins integer DEFAULT 0,
    meta_confirmacoes integer DEFAULT 0,
    meta_convites integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(prospeccao_id, user_id)
);

-- Enable RLS
ALTER TABLE public.prospeccao_metas_individuais ENABLE ROW LEVEL SECURITY;

-- Create policy for company users
CREATE POLICY "prospeccao_metas_individuais_empresa_users_all"
ON public.prospeccao_metas_individuais
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_prospeccao_metas_individuais_updated_at
BEFORE UPDATE ON public.prospeccao_metas_individuais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
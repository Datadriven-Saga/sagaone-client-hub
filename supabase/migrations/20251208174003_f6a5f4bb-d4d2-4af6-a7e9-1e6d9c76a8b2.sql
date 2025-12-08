-- Criar tabela para equipes de prospecção
CREATE TABLE public.prospeccao_equipes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prospeccao_id uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome text NOT NULL,
    cor text NOT NULL DEFAULT '#EF4444',
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para membros das equipes
CREATE TABLE public.prospeccao_equipe_membros (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    equipe_id uuid NOT NULL REFERENCES public.prospeccao_equipes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(equipe_id, user_id)
);

-- Enable RLS
ALTER TABLE public.prospeccao_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_equipe_membros ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "prospeccao_equipes_empresa_users_all"
ON public.prospeccao_equipes
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "prospeccao_equipe_membros_empresa_users_all"
ON public.prospeccao_equipe_membros
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.prospeccao_equipes e
    WHERE e.id = equipe_id AND e.empresa_id = get_user_active_company(auth.uid())
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospeccao_equipes e
    WHERE e.id = equipe_id AND e.empresa_id = get_user_active_company(auth.uid())
));

-- Create triggers for updated_at
CREATE TRIGGER update_prospeccao_equipes_updated_at
BEFORE UPDATE ON public.prospeccao_equipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Criar tabela para convites de prospecção
CREATE TABLE public.prospeccao_convites (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prospeccao_id uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE UNIQUE,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    imagem_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospeccao_convites ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "prospeccao_convites_empresa_users_all"
ON public.prospeccao_convites
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_prospeccao_convites_updated_at
BEFORE UPDATE ON public.prospeccao_convites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for invitation images
INSERT INTO storage.buckets (id, name, public) VALUES ('convites-prospeccao', 'convites-prospeccao', true);

-- Storage policies
CREATE POLICY "convites_prospeccao_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'convites-prospeccao');

CREATE POLICY "convites_prospeccao_authenticated_upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'convites-prospeccao' AND auth.role() = 'authenticated');

CREATE POLICY "convites_prospeccao_authenticated_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'convites-prospeccao' AND auth.role() = 'authenticated');

CREATE POLICY "convites_prospeccao_authenticated_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'convites-prospeccao' AND auth.role() = 'authenticated');
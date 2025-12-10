-- Create documentos_configuracao table for storing configuration documents
CREATE TABLE public.documentos_configuracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  tipo_arquivo TEXT,
  tamanho_arquivo INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on (empresa_id, nome) to prevent duplicate document names per company
CREATE UNIQUE INDEX documentos_configuracao_empresa_nome_unique ON public.documentos_configuracao(empresa_id, nome);

-- Create index for faster queries
CREATE INDEX documentos_configuracao_empresa_id_idx ON public.documentos_configuracao(empresa_id);

-- Enable RLS
ALTER TABLE public.documentos_configuracao ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company users
CREATE POLICY "documentos_configuracao_empresa_users_all" 
ON public.documentos_configuracao 
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_documentos_configuracao_updated_at
BEFORE UPDATE ON public.documentos_configuracao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for configuration documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-configuracao', 'documentos-configuracao', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for documentos-configuracao bucket
CREATE POLICY "documentos_configuracao_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos-configuracao');

CREATE POLICY "documentos_configuracao_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documentos-configuracao' AND auth.role() = 'authenticated');

CREATE POLICY "documentos_configuracao_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documentos-configuracao' AND auth.role() = 'authenticated');

CREATE POLICY "documentos_configuracao_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'documentos-configuracao' AND auth.role() = 'authenticated');
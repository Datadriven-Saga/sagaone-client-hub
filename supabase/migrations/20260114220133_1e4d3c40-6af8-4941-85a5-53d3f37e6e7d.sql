-- Create bases_importadas table to store named import batches
CREATE TABLE public.bases_importadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  total_contatos INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add base_id column to contatos table to link contacts to a base
ALTER TABLE public.contatos 
ADD COLUMN base_id UUID REFERENCES public.bases_importadas(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.bases_importadas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bases_importadas
CREATE POLICY "Users can view bases from their company"
ON public.bases_importadas
FOR SELECT
USING (user_can_access_empresa(empresa_id));

CREATE POLICY "Users can create bases for their company"
ON public.bases_importadas
FOR INSERT
WITH CHECK (user_can_access_empresa(empresa_id));

CREATE POLICY "Users can update bases from their company"
ON public.bases_importadas
FOR UPDATE
USING (user_can_access_empresa(empresa_id));

CREATE POLICY "Users can delete bases from their company"
ON public.bases_importadas
FOR DELETE
USING (user_can_access_empresa(empresa_id));

-- Create index for better performance
CREATE INDEX idx_bases_importadas_empresa_id ON public.bases_importadas(empresa_id);
CREATE INDEX idx_contatos_base_id ON public.contatos(base_id);
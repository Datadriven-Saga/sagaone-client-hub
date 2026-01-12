-- Criar tabela de relacionamento many-to-many entre agentes e empresas
CREATE TABLE public.agente_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(agente_id, empresa_id)
);

-- Enable RLS
ALTER TABLE public.agente_empresas ENABLE ROW LEVEL SECURITY;

-- Policies for viewing - users can see assignments for their company
CREATE POLICY "Users can view agent-company assignments for their company" 
ON public.agente_empresas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.empresa_id = agente_empresas.empresa_id
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.tipo_acesso = 'Administrador' OR profiles.tipo_acesso = 'TI')
  )
);

-- Policy for admins/TI to insert
CREATE POLICY "Admins and TI can create agent-company assignments" 
ON public.agente_empresas 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.tipo_acesso = 'Administrador' OR profiles.tipo_acesso = 'TI')
  )
);

-- Policy for admins/TI to delete
CREATE POLICY "Admins and TI can delete agent-company assignments" 
ON public.agente_empresas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.tipo_acesso = 'Administrador' OR profiles.tipo_acesso = 'TI')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_agente_empresas_agente_id ON public.agente_empresas(agente_id);
CREATE INDEX idx_agente_empresas_empresa_id ON public.agente_empresas(empresa_id);

-- Migrate existing data: Copy empresa_id from agentes_ia to the new junction table
INSERT INTO public.agente_empresas (agente_id, empresa_id)
SELECT id, empresa_id
FROM public.agentes_ia
WHERE empresa_id IS NOT NULL
ON CONFLICT (agente_id, empresa_id) DO NOTHING;
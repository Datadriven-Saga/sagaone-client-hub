-- Criar enum para status do agente por empresa
CREATE TYPE public.status_agente_empresa AS ENUM (
  'ativo',
  'inativo', 
  'em_desenvolvimento',
  'em_rollout',
  'pendente'
);

-- Adicionar coluna de status na tabela agente_empresas
ALTER TABLE public.agente_empresas 
ADD COLUMN status status_agente_empresa NOT NULL DEFAULT 'pendente',
ADD COLUMN observacoes TEXT,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Criar trigger para updated_at
CREATE TRIGGER update_agente_empresas_updated_at
BEFORE UPDATE ON public.agente_empresas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar política RLS para permitir UPDATE por admins e TI
CREATE POLICY "Admins and TI can update agent-company assignments"
ON public.agente_empresas
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND (profiles.tipo_acesso = 'Administrador'::tipo_acesso OR profiles.tipo_acesso = 'TI'::tipo_acesso)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND (profiles.tipo_acesso = 'Administrador'::tipo_acesso OR profiles.tipo_acesso = 'TI'::tipo_acesso)
));

-- Atualizar registros existentes para status 'ativo'
UPDATE public.agente_empresas SET status = 'ativo' WHERE status = 'pendente';
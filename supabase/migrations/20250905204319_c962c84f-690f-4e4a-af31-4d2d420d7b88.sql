-- Criar tabela para permissões de módulos por empresa
CREATE TABLE public.empresa_modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo_nome TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(empresa_id, modulo_nome)
);

-- Criar índices para melhor performance
CREATE INDEX idx_empresa_modulos_empresa_id ON public.empresa_modulos(empresa_id);
CREATE INDEX idx_empresa_modulos_ativo ON public.empresa_modulos(ativo);

-- Habilitar RLS
ALTER TABLE public.empresa_modulos ENABLE ROW LEVEL SECURITY;

-- Política para administradores gerenciarem módulos de empresa
CREATE POLICY "empresa_modulos_admins_only" 
ON public.empresa_modulos 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

-- Trigger para updated_at
CREATE TRIGGER update_empresa_modulos_updated_at
  BEFORE UPDATE ON public.empresa_modulos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
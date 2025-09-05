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
  
  -- Constraint para garantir que não haja duplicatas ativas para o mesmo módulo na mesma empresa
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

-- Inserir alguns módulos padrão disponíveis no sistema
INSERT INTO public.empresa_modulos (empresa_id, modulo_nome, data_inicio, data_fim) VALUES 
-- Pegar as empresas existentes e dar acesso a todos os módulos por padrão
-- (vamos fazer isso através do código, não aqui)

-- Comentário: Os módulos disponíveis no sistema são:
-- Dashboard, Prospecção, Clientes, Agentes IA, Personas, Gatilhos, Treinamentos, Notificações, Relatórios, Configurações, Ajuda, Administração
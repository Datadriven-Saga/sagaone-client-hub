-- Tabela para Motivos de Insucesso
CREATE TABLE public.motivos_insucesso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para Departamentos
CREATE TABLE public.departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  modelo_distribuicao TEXT NOT NULL DEFAULT 'Manual',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para Mensagens Padrão
CREATE TABLE public.mensagens_padrao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT,
  periodo_dias INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, tipo)
);

-- Tabela para Temperaturas de Lead
CREATE TABLE public.temperaturas_lead (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6b7280',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para WhatsApp Vinculados
CREATE TABLE public.whatsapp_vinculados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  usuario_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'Desconectado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.motivos_insucesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperaturas_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_vinculados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para motivos_insucesso
CREATE POLICY "motivos_insucesso_empresa_users_all" ON public.motivos_insucesso
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para departamentos
CREATE POLICY "departamentos_empresa_users_all" ON public.departamentos
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para mensagens_padrao
CREATE POLICY "mensagens_padrao_empresa_users_all" ON public.mensagens_padrao
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para temperaturas_lead
CREATE POLICY "temperaturas_lead_empresa_users_all" ON public.temperaturas_lead
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para whatsapp_vinculados
CREATE POLICY "whatsapp_vinculados_empresa_users_all" ON public.whatsapp_vinculados
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Índices
CREATE INDEX idx_motivos_insucesso_empresa ON public.motivos_insucesso(empresa_id);
CREATE INDEX idx_departamentos_empresa ON public.departamentos(empresa_id);
CREATE INDEX idx_mensagens_padrao_empresa ON public.mensagens_padrao(empresa_id);
CREATE INDEX idx_temperaturas_lead_empresa ON public.temperaturas_lead(empresa_id);
CREATE INDEX idx_whatsapp_vinculados_empresa ON public.whatsapp_vinculados(empresa_id);
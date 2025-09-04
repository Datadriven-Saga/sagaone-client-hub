-- Criar tabela de agentes de IA
CREATE TABLE public.agentes_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  persona TEXT,
  cerebro TEXT,
  telefone TEXT,
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de follow-ups dos agentes (baseada nos gatilhos)
CREATE TABLE public.agente_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  acoes JSONB,
  condicoes JSONB,
  empresa_id UUID,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agente_id) REFERENCES public.agentes_ia(id) ON DELETE CASCADE
);

-- Criar tabela de cadência dos agentes
CREATE TABLE public.agente_cadencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL,
  quantidade_etapas INTEGER NOT NULL DEFAULT 4,
  delay_inicial_minutos INTEGER NOT NULL DEFAULT 0,
  intervalo_etapas_minutos INTEGER NOT NULL DEFAULT 60,
  horario_inicio TIME NOT NULL DEFAULT '09:00:00',
  horario_fim TIME NOT NULL DEFAULT '18:00:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  dias_semana JSONB NOT NULL DEFAULT '["segunda","terca","quarta","quinta","sexta","sabado","domingo"]',
  gatilho_cadencia TEXT NOT NULL DEFAULT 'inatividade_cliente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agente_id) REFERENCES public.agentes_ia(id) ON DELETE CASCADE
);

-- Criar tabela de integração dos agentes
CREATE TABLE public.agente_integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL,
  evolution_id TEXT,
  banco_dados_ia TEXT,
  tabela_historico_ia TEXT,
  webhook_metodo TEXT NOT NULL DEFAULT 'POST',
  webhook_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agente_id) REFERENCES public.agentes_ia(id) ON DELETE CASCADE
);

-- Criar tabela de performance dos agentes
CREATE TABLE public.agente_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL,
  followups_executados INTEGER NOT NULL DEFAULT 0,
  cadencias_executadas INTEGER NOT NULL DEFAULT 0,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  empresa_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agente_id) REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  UNIQUE(agente_id, data_registro)
);

-- Habilitar RLS para todas as tabelas
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_cadencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_performance ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para agentes_ia (apenas TI e Administrador)
CREATE POLICY "agentes_ia_admins_ti_only" 
ON public.agentes_ia 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Criar políticas RLS para agente_followups
CREATE POLICY "agente_followups_admins_ti_only" 
ON public.agente_followups 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Criar políticas RLS para agente_cadencias
CREATE POLICY "agente_cadencias_admins_ti_only" 
ON public.agente_cadencias 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Criar políticas RLS para agente_integracoes
CREATE POLICY "agente_integracoes_admins_ti_only" 
ON public.agente_integracoes 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Criar políticas RLS para agente_performance
CREATE POLICY "agente_performance_admins_ti_only" 
ON public.agente_performance 
FOR ALL 
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  AND empresa_id = get_user_active_company(auth.uid())
);

-- Adicionar triggers para updated_at
CREATE TRIGGER update_agentes_ia_updated_at
  BEFORE UPDATE ON public.agentes_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agente_followups_updated_at
  BEFORE UPDATE ON public.agente_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agente_cadencias_updated_at
  BEFORE UPDATE ON public.agente_cadencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agente_integracoes_updated_at
  BEFORE UPDATE ON public.agente_integracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar trigger para setar empresa_id automaticamente
CREATE TRIGGER set_agentes_ia_empresa_id
  BEFORE INSERT ON public.agentes_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_agente_followups_empresa_id
  BEFORE INSERT ON public.agente_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_agente_cadencias_empresa_id
  BEFORE INSERT ON public.agente_cadencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_agente_integracoes_empresa_id
  BEFORE INSERT ON public.agente_integracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_agente_performance_empresa_id
  BEFORE INSERT ON public.agente_performance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();
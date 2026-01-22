-- =============================================
-- Tabelas de Backup para Sistema PRI Voz
-- =============================================

-- 1. Tabela eventos_pri_voz (backup de eventos de ligação)
CREATE TABLE public.eventos_pri_voz (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento INTEGER NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  marca TEXT,
  dealerid TEXT,
  telefone_pri TEXT,
  uf TEXT,
  cidade TEXT,
  endereco TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_fim TIMESTAMP WITH TIME ZONE,
  evt_status TEXT DEFAULT 'ativo',
  telefone_pri_whatsapp TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela prospect_pri_voz (backup de leads/prospects)
CREATE TABLE public.prospect_pri_voz (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone_lead TEXT NOT NULL,
  id_evento INTEGER NOT NULL,
  nome TEXT,
  telefone_pri TEXT,
  proposal_id TEXT,
  loja TEXT,
  ligacao_atendida BOOLEAN DEFAULT false,
  status_agendado BOOLEAN DEFAULT false,
  enviado_whatsapp BOOLEAN DEFAULT false,
  ligacao_erro BOOLEAN DEFAULT false,
  lead_id TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(telefone_lead, id_evento)
);

-- 3. Tabela cadencia_pri_voz (backup de cadências de ligação)
CREATE TABLE public.cadencia_pri_voz (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone_lead TEXT NOT NULL,
  telefone_pri TEXT,
  id_evento INTEGER NOT NULL,
  num_tentativas INTEGER DEFAULT 0,
  hora_primeira_tentativa TIMESTAMP WITH TIME ZONE,
  hora_ultima_tentativa TIMESTAMP WITH TIME ZONE,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(telefone_lead, id_evento)
);

-- Índices para performance
CREATE INDEX idx_eventos_pri_voz_id_evento ON public.eventos_pri_voz(id_evento);
CREATE INDEX idx_eventos_pri_voz_empresa ON public.eventos_pri_voz(empresa_id);
CREATE INDEX idx_eventos_pri_voz_status ON public.eventos_pri_voz(evt_status);

CREATE INDEX idx_prospect_pri_voz_id_evento ON public.prospect_pri_voz(id_evento);
CREATE INDEX idx_prospect_pri_voz_empresa ON public.prospect_pri_voz(empresa_id);
CREATE INDEX idx_prospect_pri_voz_telefone ON public.prospect_pri_voz(telefone_lead);

CREATE INDEX idx_cadencia_pri_voz_id_evento ON public.cadencia_pri_voz(id_evento);
CREATE INDEX idx_cadencia_pri_voz_empresa ON public.cadencia_pri_voz(empresa_id);
CREATE INDEX idx_cadencia_pri_voz_telefone ON public.cadencia_pri_voz(telefone_lead);

-- Habilitar RLS
ALTER TABLE public.eventos_pri_voz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_pri_voz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadencia_pri_voz ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para eventos_pri_voz
CREATE POLICY "eventos_pri_voz_empresa_users_all" ON public.eventos_pri_voz
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para prospect_pri_voz
CREATE POLICY "prospect_pri_voz_empresa_users_all" ON public.prospect_pri_voz
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Políticas RLS para cadencia_pri_voz
CREATE POLICY "cadencia_pri_voz_empresa_users_all" ON public.cadencia_pri_voz
  FOR ALL USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Triggers para atualizar atualizado_em
CREATE TRIGGER update_eventos_pri_voz_updated_at
  BEFORE UPDATE ON public.eventos_pri_voz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospect_pri_voz_updated_at
  BEFORE UPDATE ON public.prospect_pri_voz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cadencia_pri_voz_updated_at
  BEFORE UPDATE ON public.cadencia_pri_voz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Tabela: Visão dos Agentes (configuração global de tipos de agentes)
CREATE TABLE public.agentes_visao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  criador TEXT,
  strategica BOOLEAN NOT NULL DEFAULT false,
  tipo_implantacao TEXT NOT NULL DEFAULT 'Marca/UF',
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: Cronograma de Implantação
CREATE TABLE public.cronograma_implantacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_visao_id UUID REFERENCES public.agentes_visao(id) ON DELETE SET NULL,
  fase TEXT NOT NULL,
  unidades TEXT NOT NULL,
  atividade TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_termino DATE NOT NULL,
  observacoes TEXT,
  concluido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agentes_visao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_implantacao ENABLE ROW LEVEL SECURITY;

-- Policies for agentes_visao
CREATE POLICY "agentes_visao_admins_ti_full_access" ON public.agentes_visao
FOR ALL USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

CREATE POLICY "agentes_visao_users_select" ON public.agentes_visao
FOR SELECT USING (true);

-- Policies for cronograma_implantacao
CREATE POLICY "cronograma_implantacao_admins_ti_full_access" ON public.cronograma_implantacao
FOR ALL USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

CREATE POLICY "cronograma_implantacao_users_select" ON public.cronograma_implantacao
FOR SELECT USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_agentes_visao_updated_at
  BEFORE UPDATE ON public.agentes_visao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cronograma_implantacao_updated_at
  BEFORE UPDATE ON public.cronograma_implantacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais de agentes_visao
INSERT INTO public.agentes_visao (nome, tipo, criador, strategica, tipo_implantacao, ordem) VALUES
  ('Paty', 'Entrega', 'Fernanda', false, 'Marca/UF', 1),
  ('Aila', 'Prosc. Acessorios', 'Ana', false, 'Marca/UF', 2),
  ('Bela', 'Busca e Resgate', 'John', true, 'Marca/UF', 3),
  ('IA Remuneração', 'Controladoria', 'Moroni', false, 'Unica', 4),
  ('IA de Benefícios', 'Controladoria', 'Moroni', false, 'Unica', 5),
  ('Steve', 'Projetos', 'Moroni', false, 'Unica', 6),
  ('IA Análise Despesas', 'Controladoria', 'Pedro', false, 'Unica', 7),
  ('Pri', 'Prospecção (Ligação)', 'João', false, 'UF', 8),
  ('Silvia', 'Seguros', 'John', false, 'Marca/UF', 9),
  ('Cecilia', 'Consórcio', 'John', false, 'UF', 10),
  ('Maia', 'Qualificação', 'Douglas', true, 'Marca/UF', 11),
  ('Gabi', 'Gerente', 'Douglas', true, 'Marca', 12),
  ('Lia', 'Ligação Perdida', 'Moroni', true, 'Marca/UF', 13);

-- Inserir dados iniciais de cronograma
INSERT INTO public.cronograma_implantacao (fase, unidades, atividade, data_inicio, data_termino) VALUES
  ('Fase 1', '01 a 05', 'Implantação Lote 1', '2025-02-09', '2025-02-19'),
  ('Fase 1', '06 a 10', 'Implantação Lote 2', '2025-02-20', '2025-03-02'),
  ('INFRA', '01 a 10', 'Escalonamento e Testes', '2025-03-03', '2025-03-05'),
  ('Fase 2', '11 a 15', 'Implantação Lote 3', '2025-03-06', '2025-03-16'),
  ('Fase 2', '16 a 20', 'Implantação Lote 4', '2025-03-17', '2025-03-25'),
  ('INFRA', '11 a 20', 'Escalonamento e Testes', '2025-03-26', '2025-03-30'),
  ('Fase 3', '21 a 25', 'Implantação Lote 5', '2025-03-31', '2025-04-09'),
  ('Fase 3', '26 a 30', 'Implantação Lote 6', '2025-04-10', '2025-04-20'),
  ('INFRA', '21 a 30', 'Escalonamento e Testes', '2025-04-22', '2025-04-24'),
  ('Fase 4', '31 a 35', 'Implantação Lote 7', '2025-04-27', '2025-05-06'),
  ('Fase 4', '36 a 40', 'Implantação Lote 8', '2025-05-07', '2025-05-15'),
  ('FINAL', '31 a 40', 'Escalonamento e Testes', '2025-05-18', '2025-05-20');
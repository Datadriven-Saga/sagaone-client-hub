-- =====================================================
-- SAGA ACADEMY - SCHEMA COMPLETO
-- =====================================================

-- 1. CURSOS/TREINAMENTOS
CREATE TABLE public.academy_treinamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
    criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Informações básicas
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL CHECK (tipo IN ('texto', 'audio', 'video', 'simulacao')),
    
    -- Público-alvo (JSON array de departamentos/cargos)
    publico_alvo jsonb DEFAULT '[]'::jsonb,
    
    -- Status e configurações
    status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
    obrigatorio boolean DEFAULT false,
    ordem integer DEFAULT 0,
    
    -- Conteúdo
    conteudo jsonb DEFAULT '{}'::jsonb, -- Módulos, etapas, configurações
    
    -- Metadados
    duracao_estimada_minutos integer,
    nivel text CHECK (nivel IN ('iniciante', 'intermediario', 'avancado')),
    tags jsonb DEFAULT '[]'::jsonb,
    
    -- Importação externa
    fonte_externa text, -- URL ou nome do curso importado
    formato_original text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. MÓDULOS/ETAPAS DO TREINAMENTO
CREATE TABLE public.academy_modulos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    treinamento_id uuid NOT NULL REFERENCES public.academy_treinamentos(id) ON DELETE CASCADE,
    
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL CHECK (tipo IN ('texto', 'video', 'audio', 'quiz', 'simulacao')),
    
    -- Conteúdo
    conteudo jsonb DEFAULT '{}'::jsonb,
    
    -- Ordem e navegação
    ordem integer NOT NULL DEFAULT 0,
    duracao_estimada_minutos integer,
    
    -- Configurações
    obrigatorio boolean DEFAULT true,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. SIMULAÇÕES (para treinos de voz/texto)
CREATE TABLE public.academy_simulacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    treinamento_id uuid REFERENCES public.academy_treinamentos(id) ON DELETE CASCADE,
    empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
    criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL CHECK (tipo IN ('voz', 'texto')),
    
    -- Configuração do cenário
    cenario jsonb NOT NULL DEFAULT '{}'::jsonb, -- Contexto, persona do cliente, objetivo
    
    -- Critérios de avaliação (dimensões)
    criterios_avaliacao jsonb NOT NULL DEFAULT '[
        {"dimensao": "Situação", "peso": 20, "itens": []},
        {"dimensao": "Problema", "peso": 20, "itens": []},
        {"dimensao": "Implicação", "peso": 20, "itens": []},
        {"dimensao": "Negociação e Objeção", "peso": 20, "itens": []},
        {"dimensao": "Fechamento e Próximos Passos", "peso": 20, "itens": []}
    ]'::jsonb,
    
    -- Configuração de voz (OpenAI/Whisper)
    config_voz jsonb DEFAULT '{}'::jsonb,
    
    -- Status
    ativo boolean DEFAULT true,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. ATRIBUIÇÕES DE TREINAMENTO
CREATE TABLE public.academy_atribuicoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    treinamento_id uuid NOT NULL REFERENCES public.academy_treinamentos(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    atribuido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Configurações da atribuição
    obrigatorio boolean DEFAULT false,
    data_limite timestamptz,
    prioridade integer DEFAULT 0,
    
    -- Status
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'expirado')),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(treinamento_id, user_id)
);

-- 5. PROGRESSO DO USUÁRIO
CREATE TABLE public.academy_progresso (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treinamento_id uuid NOT NULL REFERENCES public.academy_treinamentos(id) ON DELETE CASCADE,
    modulo_id uuid REFERENCES public.academy_modulos(id) ON DELETE SET NULL,
    
    -- Status
    status text NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
    
    -- Progresso
    percentual_concluido integer DEFAULT 0 CHECK (percentual_concluido >= 0 AND percentual_concluido <= 100),
    tempo_gasto_minutos integer DEFAULT 0,
    
    -- Avaliação
    nota numeric(4,2),
    tentativas integer DEFAULT 0,
    
    -- Dados adicionais
    dados_progresso jsonb DEFAULT '{}'::jsonb,
    
    data_inicio timestamptz,
    data_conclusao timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, treinamento_id, modulo_id)
);

-- 6. SESSÕES DE SIMULAÇÃO
CREATE TABLE public.academy_sessoes_simulacao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    simulacao_id uuid NOT NULL REFERENCES public.academy_simulacoes(id) ON DELETE CASCADE,
    
    -- Duração
    data_inicio timestamptz NOT NULL DEFAULT now(),
    data_fim timestamptz,
    duracao_segundos integer,
    
    -- Transcrição (para simulações de voz)
    transcricao jsonb DEFAULT '[]'::jsonb, -- Array de mensagens
    
    -- Avaliação por dimensão
    avaliacoes jsonb DEFAULT '{}'::jsonb,
    -- Exemplo: {
    --   "Situação": {"nota": 7.5, "itens": [...]},
    --   "Problema": {"nota": 8.0, "itens": [...]}
    -- }
    
    nota_final numeric(4,2),
    
    -- Feedback da IA
    feedback_ia text,
    pontos_fortes jsonb DEFAULT '[]'::jsonb,
    pontos_melhoria jsonb DEFAULT '[]'::jsonb,
    
    -- Status
    status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida', 'abandonada')),
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. RECOMENDAÇÕES PERSONALIZADAS
CREATE TABLE public.academy_recomendacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de recomendação
    tipo text NOT NULL CHECK (tipo IN ('treinamento', 'simulacao', 'melhoria', 'geral')),
    
    -- Referência (pode ser treinamento, simulação, etc.)
    referencia_id uuid,
    referencia_tipo text,
    
    -- Conteúdo
    titulo text NOT NULL,
    descricao text NOT NULL,
    prioridade integer DEFAULT 0,
    
    -- Contexto (baseado em quê foi gerada)
    contexto jsonb DEFAULT '{}'::jsonb,
    
    -- Status
    visualizada boolean DEFAULT false,
    acionada boolean DEFAULT false,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz
);

-- 8. MÉTRICAS AGREGADAS DO USUÁRIO (para dashboard rápido)
CREATE TABLE public.academy_metricas_usuario (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Contadores
    total_treinamentos_disponiveis integer DEFAULT 0,
    treinamentos_concluidos integer DEFAULT 0,
    treinamentos_em_andamento integer DEFAULT 0,
    
    total_simulacoes_realizadas integer DEFAULT 0,
    
    -- Médias de desempenho por dimensão
    media_situacao numeric(4,2) DEFAULT 0,
    media_problema numeric(4,2) DEFAULT 0,
    media_implicacao numeric(4,2) DEFAULT 0,
    media_negociacao numeric(4,2) DEFAULT 0,
    media_fechamento numeric(4,2) DEFAULT 0,
    media_geral numeric(4,2) DEFAULT 0,
    
    -- Tempo
    tempo_total_minutos integer DEFAULT 0,
    
    -- Ranking
    pontuacao_ranking integer DEFAULT 0,
    posicao_ranking integer,
    
    -- Última atualização
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX idx_academy_treinamentos_empresa ON public.academy_treinamentos(empresa_id);
CREATE INDEX idx_academy_treinamentos_status ON public.academy_treinamentos(status);
CREATE INDEX idx_academy_modulos_treinamento ON public.academy_modulos(treinamento_id);
CREATE INDEX idx_academy_simulacoes_empresa ON public.academy_simulacoes(empresa_id);
CREATE INDEX idx_academy_atribuicoes_user ON public.academy_atribuicoes(user_id);
CREATE INDEX idx_academy_atribuicoes_treinamento ON public.academy_atribuicoes(treinamento_id);
CREATE INDEX idx_academy_progresso_user ON public.academy_progresso(user_id);
CREATE INDEX idx_academy_progresso_treinamento ON public.academy_progresso(treinamento_id);
CREATE INDEX idx_academy_sessoes_user ON public.academy_sessoes_simulacao(user_id);
CREATE INDEX idx_academy_sessoes_simulacao ON public.academy_sessoes_simulacao(simulacao_id);
CREATE INDEX idx_academy_recomendacoes_user ON public.academy_recomendacoes(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.academy_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_sessoes_simulacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_metricas_usuario ENABLE ROW LEVEL SECURITY;

-- Treinamentos: gestores podem gerenciar, usuários podem ver os publicados/atribuídos
CREATE POLICY "academy_treinamentos_gestores_full" ON public.academy_treinamentos
FOR ALL USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

CREATE POLICY "academy_treinamentos_usuarios_select" ON public.academy_treinamentos
FOR SELECT USING (
    status = 'publicado' AND (
        empresa_id = get_user_active_company(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.academy_atribuicoes a
            WHERE a.treinamento_id = academy_treinamentos.id
            AND a.user_id = auth.uid()
        )
    )
);

-- Módulos: seguem as permissões do treinamento pai
CREATE POLICY "academy_modulos_via_treinamento" ON public.academy_modulos
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.academy_treinamentos t
        WHERE t.id = academy_modulos.treinamento_id
    )
);

-- Simulações: gestores podem gerenciar
CREATE POLICY "academy_simulacoes_gestores_full" ON public.academy_simulacoes
FOR ALL USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
);

CREATE POLICY "academy_simulacoes_usuarios_select" ON public.academy_simulacoes
FOR SELECT USING (
    ativo = true AND empresa_id = get_user_active_company(auth.uid())
);

-- Atribuições: gestores podem gerenciar, usuários veem as suas
CREATE POLICY "academy_atribuicoes_gestores_full" ON public.academy_atribuicoes
FOR ALL USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

CREATE POLICY "academy_atribuicoes_usuarios_select" ON public.academy_atribuicoes
FOR SELECT USING (user_id = auth.uid());

-- Progresso: cada usuário gerencia o próprio, gestores veem todos
CREATE POLICY "academy_progresso_proprio" ON public.academy_progresso
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "academy_progresso_gestores_select" ON public.academy_progresso
FOR SELECT USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

-- Sessões de simulação: próprio usuário + gestores
CREATE POLICY "academy_sessoes_proprio" ON public.academy_sessoes_simulacao
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "academy_sessoes_gestores_select" ON public.academy_sessoes_simulacao
FOR SELECT USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

-- Recomendações: somente o próprio usuário
CREATE POLICY "academy_recomendacoes_proprio" ON public.academy_recomendacoes
FOR ALL USING (user_id = auth.uid());

-- Métricas: próprio usuário + gestores para select
CREATE POLICY "academy_metricas_proprio" ON public.academy_metricas_usuario
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "academy_metricas_gestores_select" ON public.academy_metricas_usuario
FOR SELECT USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

-- =====================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Trigger para updated_at
CREATE TRIGGER update_academy_treinamentos_updated_at
    BEFORE UPDATE ON public.academy_treinamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_modulos_updated_at
    BEFORE UPDATE ON public.academy_modulos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_simulacoes_updated_at
    BEFORE UPDATE ON public.academy_simulacoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_atribuicoes_updated_at
    BEFORE UPDATE ON public.academy_atribuicoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_progresso_updated_at
    BEFORE UPDATE ON public.academy_progresso
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_metricas_updated_at
    BEFORE UPDATE ON public.academy_metricas_usuario
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNÇÃO PARA RECALCULAR MÉTRICAS DO USUÁRIO
-- =====================================================

CREATE OR REPLACE FUNCTION public.academy_recalcular_metricas_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
BEGIN
    -- Obter empresa do usuário
    SELECT empresa_id INTO v_empresa_id FROM profiles WHERE id = p_user_id;
    
    -- Upsert nas métricas
    INSERT INTO academy_metricas_usuario (
        user_id,
        total_treinamentos_disponiveis,
        treinamentos_concluidos,
        treinamentos_em_andamento,
        total_simulacoes_realizadas,
        media_situacao,
        media_problema,
        media_implicacao,
        media_negociacao,
        media_fechamento,
        media_geral,
        tempo_total_minutos,
        updated_at
    )
    SELECT
        p_user_id,
        -- Total disponíveis (publicados + atribuídos)
        COALESCE((
            SELECT COUNT(DISTINCT t.id)
            FROM academy_treinamentos t
            LEFT JOIN academy_atribuicoes a ON a.treinamento_id = t.id AND a.user_id = p_user_id
            WHERE t.empresa_id = v_empresa_id AND t.status = 'publicado'
        ), 0),
        -- Concluídos
        COALESCE((
            SELECT COUNT(DISTINCT treinamento_id)
            FROM academy_progresso
            WHERE user_id = p_user_id AND status = 'concluido'
        ), 0),
        -- Em andamento
        COALESCE((
            SELECT COUNT(DISTINCT treinamento_id)
            FROM academy_progresso
            WHERE user_id = p_user_id AND status = 'em_andamento'
        ), 0),
        -- Simulações realizadas
        COALESCE((
            SELECT COUNT(*)
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        -- Médias por dimensão (das sessões de simulação)
        COALESCE((
            SELECT AVG((avaliacoes->>'Situação')::jsonb->>'nota')::numeric
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        COALESCE((
            SELECT AVG((avaliacoes->>'Problema')::jsonb->>'nota')::numeric
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        COALESCE((
            SELECT AVG((avaliacoes->>'Implicação')::jsonb->>'nota')::numeric
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        COALESCE((
            SELECT AVG((avaliacoes->>'Negociação e Objeção')::jsonb->>'nota')::numeric
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        COALESCE((
            SELECT AVG((avaliacoes->>'Fechamento e Próximos Passos')::jsonb->>'nota')::numeric
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        COALESCE((
            SELECT AVG(nota_final)
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        -- Tempo total
        COALESCE((
            SELECT SUM(tempo_gasto_minutos)
            FROM academy_progresso
            WHERE user_id = p_user_id
        ), 0),
        now()
    ON CONFLICT (user_id) DO UPDATE SET
        total_treinamentos_disponiveis = EXCLUDED.total_treinamentos_disponiveis,
        treinamentos_concluidos = EXCLUDED.treinamentos_concluidos,
        treinamentos_em_andamento = EXCLUDED.treinamentos_em_andamento,
        total_simulacoes_realizadas = EXCLUDED.total_simulacoes_realizadas,
        media_situacao = EXCLUDED.media_situacao,
        media_problema = EXCLUDED.media_problema,
        media_implicacao = EXCLUDED.media_implicacao,
        media_negociacao = EXCLUDED.media_negociacao,
        media_fechamento = EXCLUDED.media_fechamento,
        media_geral = EXCLUDED.media_geral,
        tempo_total_minutos = EXCLUDED.tempo_total_minutos,
        updated_at = now();
END;
$$;
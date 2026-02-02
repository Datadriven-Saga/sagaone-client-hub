-- Fix the metrics calculation function with proper JSON casting
CREATE OR REPLACE FUNCTION public.academy_recalcular_metricas_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
BEGIN
    -- Get user's company
    SELECT empresa_id INTO v_empresa_id FROM profiles WHERE id = p_user_id;
    
    -- Upsert into metrics
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
        -- Total available (published + assigned)
        COALESCE((
            SELECT COUNT(DISTINCT t.id)
            FROM academy_treinamentos t
            LEFT JOIN academy_atribuicoes a ON a.treinamento_id = t.id AND a.user_id = p_user_id
            WHERE t.empresa_id = v_empresa_id AND t.status = 'publicado'
        ), 0),
        -- Completed
        COALESCE((
            SELECT COUNT(DISTINCT treinamento_id)
            FROM academy_progresso
            WHERE user_id = p_user_id AND status = 'concluido'
        ), 0),
        -- In progress
        COALESCE((
            SELECT COUNT(DISTINCT treinamento_id)
            FROM academy_progresso
            WHERE user_id = p_user_id AND status = 'em_andamento'
        ), 0),
        -- Simulations completed
        COALESCE((
            SELECT COUNT(*)
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        -- Dimension averages (from simulation sessions) - Fixed JSON casting
        COALESCE((
            SELECT AVG(((avaliacoes->'Situação'->>'nota')::numeric))
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida' AND avaliacoes->'Situação'->>'nota' IS NOT NULL
        ), 0),
        COALESCE((
            SELECT AVG(((avaliacoes->'Problema'->>'nota')::numeric))
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida' AND avaliacoes->'Problema'->>'nota' IS NOT NULL
        ), 0),
        COALESCE((
            SELECT AVG(((avaliacoes->'Implicação'->>'nota')::numeric))
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida' AND avaliacoes->'Implicação'->>'nota' IS NOT NULL
        ), 0),
        COALESCE((
            SELECT AVG(((avaliacoes->'Negociação e Objeção'->>'nota')::numeric))
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida' AND avaliacoes->'Negociação e Objeção'->>'nota' IS NOT NULL
        ), 0),
        COALESCE((
            SELECT AVG(((avaliacoes->'Fechamento e Próximos Passos'->>'nota')::numeric))
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida' AND avaliacoes->'Fechamento e Próximos Passos'->>'nota' IS NOT NULL
        ), 0),
        -- General average from nota_final
        COALESCE((
            SELECT AVG(nota_final)
            FROM academy_sessoes_simulacao
            WHERE user_id = p_user_id AND status = 'concluida'
        ), 0),
        -- Total time
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

-- Update existing sessions with dimension scores based on nota_final
UPDATE academy_sessoes_simulacao 
SET avaliacoes = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(avaliacoes::jsonb, '{}'::jsonb),
          '{Situação}', jsonb_build_object('nota', nota_final)
        ),
        '{Problema}', jsonb_build_object('nota', nota_final)
      ),
      '{Implicação}', jsonb_build_object('nota', nota_final)
    ),
    '{Negociação e Objeção}', jsonb_build_object('nota', nota_final)
  ),
  '{Fechamento e Próximos Passos}', jsonb_build_object('nota', nota_final)
)
WHERE status = 'concluida' AND nota_final IS NOT NULL;

-- Recalculate metrics for all users with completed sessions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT DISTINCT user_id FROM academy_sessoes_simulacao WHERE status = 'concluida'
    LOOP
        PERFORM academy_recalcular_metricas_usuario(r.user_id);
    END LOOP;
END $$;
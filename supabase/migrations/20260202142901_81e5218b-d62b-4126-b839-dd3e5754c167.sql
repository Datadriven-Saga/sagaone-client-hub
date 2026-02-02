-- Backfill training-level progress for simulation sessions so the Dashboard tabs
-- “Métricas de uso” (tempo_total_minutos / contadores) and “Tabela de análises” populate.

-- 1) If duplicates exist for training-level rows (modulo_id IS NULL), keep the most recent.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, treinamento_id
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM public.academy_progresso
  WHERE modulo_id IS NULL
)
DELETE FROM public.academy_progresso p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Enforce uniqueness for training-level progress rows (prevents NULL-unique duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS academy_progresso_unique_treinamento_level
ON public.academy_progresso (user_id, treinamento_id)
WHERE modulo_id IS NULL;

-- 3) Aggregate concluded simulation sessions into training-level progress.
WITH sess AS (
  SELECT
    s.user_id,
    COALESCE(sim.treinamento_id, t.id) AS treinamento_id,
    s.data_inicio,
    COALESCE(s.data_fim, s.data_inicio) AS data_fim,
    COALESCE(s.duracao_segundos, 0) AS duracao_segundos,
    s.nota_final
  FROM public.academy_sessoes_simulacao s
  LEFT JOIN public.academy_simulacoes sim
    ON sim.id = s.simulacao_id
  LEFT JOIN public.academy_treinamentos t
    ON (t.conteudo->>'simulacao_id') = s.simulacao_id::text
  WHERE s.status = 'concluida'
), agg AS (
  SELECT
    user_id,
    treinamento_id,
    MIN(data_inicio) AS min_inicio,
    MAX(data_fim) AS max_fim,
    COUNT(*)::int AS tentativas,
    SUM(CEIL(duracao_segundos / 60.0))::int AS tempo_gasto_minutos,
    MAX(nota_final) AS melhor_nota
  FROM sess
  WHERE treinamento_id IS NOT NULL
  GROUP BY user_id, treinamento_id
)
INSERT INTO public.academy_progresso (
  user_id,
  treinamento_id,
  modulo_id,
  status,
  percentual_concluido,
  nota,
  tentativas,
  tempo_gasto_minutos,
  data_inicio,
  data_conclusao,
  dados_progresso
)
SELECT
  a.user_id,
  a.treinamento_id,
  NULL,
  'concluido',
  100,
  a.melhor_nota,
  a.tentativas,
  a.tempo_gasto_minutos,
  a.min_inicio,
  a.max_fim,
  '{}'::jsonb
FROM agg a
ON CONFLICT (user_id, treinamento_id) WHERE (modulo_id IS NULL)
DO UPDATE SET
  status = 'concluido',
  percentual_concluido = 100,
  nota = GREATEST(COALESCE(public.academy_progresso.nota, 0), COALESCE(EXCLUDED.nota, 0)),
  tentativas = GREATEST(COALESCE(public.academy_progresso.tentativas, 0), COALESCE(EXCLUDED.tentativas, 0)),
  tempo_gasto_minutos = GREATEST(COALESCE(public.academy_progresso.tempo_gasto_minutos, 0), COALESCE(EXCLUDED.tempo_gasto_minutos, 0)),
  data_inicio = LEAST(public.academy_progresso.data_inicio, EXCLUDED.data_inicio),
  data_conclusao = GREATEST(public.academy_progresso.data_conclusao, EXCLUDED.data_conclusao),
  updated_at = now();

-- 4) Recalculate metrics for users that have concluded sessions.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT DISTINCT user_id
    FROM public.academy_sessoes_simulacao
    WHERE status = 'concluida'
  ) LOOP
    PERFORM public.academy_recalcular_metricas_usuario(r.user_id);
  END LOOP;
END;
$$;
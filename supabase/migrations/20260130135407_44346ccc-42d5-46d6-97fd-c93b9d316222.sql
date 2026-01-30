-- Add FK so PostgREST can embed profile:user_id in history queries
DO $$
BEGIN
  ALTER TABLE public.academy_sessoes_simulacao
    ADD CONSTRAINT academy_sessoes_simulacao_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END$$;

CREATE INDEX IF NOT EXISTS idx_academy_sessoes_simulacao_user_id
  ON public.academy_sessoes_simulacao(user_id);

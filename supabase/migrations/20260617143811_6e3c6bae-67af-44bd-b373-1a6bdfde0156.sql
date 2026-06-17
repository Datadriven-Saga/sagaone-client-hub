
-- Reformula tabela notificacoes (tabela vazia)
ALTER TABLE public.notificacoes ALTER COLUMN tipo DROP DEFAULT;
ALTER TABLE public.notificacoes ALTER COLUMN tipo TYPE text USING tipo::text;
ALTER TABLE public.notificacoes ALTER COLUMN tipo SET DEFAULT 'Sistema';

ALTER TABLE public.notificacoes ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.notificacoes ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.notificacoes ALTER COLUMN status SET DEFAULT 'Pendente';

ALTER TABLE public.notificacoes ALTER COLUMN mensagem DROP NOT NULL;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS lida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida_created
  ON public.notificacoes (user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created
  ON public.notificacoes (user_id, created_at DESC);

-- Grants
GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

-- RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_select_own" ON public.notificacoes;
CREATE POLICY "notificacoes_select_own" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notificacoes_update_own" ON public.notificacoes;
CREATE POLICY "notificacoes_update_own" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.notificacoes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificacoes_updated_at ON public.notificacoes;
CREATE TRIGGER trg_notificacoes_updated_at
  BEFORE UPDATE ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.notificacoes_set_updated_at();

-- Realtime
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

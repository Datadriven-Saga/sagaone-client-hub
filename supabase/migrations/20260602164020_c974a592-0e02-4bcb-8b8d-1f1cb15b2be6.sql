ALTER TABLE public.import_logs
  ADD COLUMN IF NOT EXISTS rejected_responsavel integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_reasons jsonb NOT NULL DEFAULT '{"profile_inexistente":0,"fora_da_equipe":0}'::jsonb;
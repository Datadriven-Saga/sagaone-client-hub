ALTER TABLE public.import_logs
  ADD COLUMN IF NOT EXISTS skipped_duplicate_in_file int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_empty_phone       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_by_user_conflict  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_optout_externo    int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_optout_global     int NOT NULL DEFAULT 0;
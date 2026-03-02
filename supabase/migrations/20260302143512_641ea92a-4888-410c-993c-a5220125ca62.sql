
-- Add quarantined column to import_logs
ALTER TABLE public.import_logs 
  ADD COLUMN IF NOT EXISTS quarantined integer DEFAULT 0;


-- 1) Storage bucket for import files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('import-files', 'import-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload import files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'import-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read import files"
ON storage.objects FOR SELECT
USING (bucket_id = 'import-files' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can read import files"
ON storage.objects FOR SELECT
USING (bucket_id = 'import-files');

CREATE POLICY "Users can delete their import files"
ON storage.objects FOR DELETE
USING (bucket_id = 'import-files' AND auth.role() = 'authenticated');

-- 2) Import logs table for real-time progress tracking
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  prospeccao_id UUID REFERENCES public.prospeccoes(id),
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  linked INTEGER DEFAULT 0,
  already_linked INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  current_offset INTEGER DEFAULT 0,
  base_id UUID REFERENCES public.bases_importadas(id),
  origem TEXT DEFAULT 'Outros',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company import logs"
ON public.import_logs FOR SELECT
USING (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Users can create import logs for their company"
ON public.import_logs FOR INSERT
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Service role full access to import logs"
ON public.import_logs FOR ALL
USING (true)
WITH CHECK (true);

-- Enable Realtime for live progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_logs;

-- Trigger for updated_at
CREATE TRIGGER update_import_logs_updated_at
BEFORE UPDATE ON public.import_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

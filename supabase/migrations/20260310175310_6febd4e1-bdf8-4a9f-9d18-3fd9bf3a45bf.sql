
-- Track paused templates and their replacements
CREATE TABLE public.template_pausado_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_meta_original text NOT NULL,
  template_original_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_duplicado_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_duplicate',
  eventos_impactados jsonb NOT NULL DEFAULT '[]'::jsonb,
  pri_telefone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.template_pausado_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access and authenticated users read access
CREATE POLICY "Service role full access on template_pausado_log"
  ON public.template_pausado_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- New column on prospeccoes to block dispatches when template is paused
ALTER TABLE public.prospeccoes
  ADD COLUMN IF NOT EXISTS disparos_pausados boolean DEFAULT false;

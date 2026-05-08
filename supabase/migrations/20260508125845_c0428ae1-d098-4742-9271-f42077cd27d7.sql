ALTER TABLE public.pos_vendas_cadencia_config
  ADD COLUMN IF NOT EXISTS template_aniversario_id uuid NULL REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_previsao_id uuid NULL REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;
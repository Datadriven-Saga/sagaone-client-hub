
-- Add cadencia_completa + template columns to prospeccoes
ALTER TABLE public.prospeccoes 
  ADD COLUMN IF NOT EXISTS cadencia_completa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_agendado_48h_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_agendado_24h_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

-- Insert feature flag for cadencia completa
INSERT INTO public.system_feature_flags (flag_key, flag_label, description, category, is_enabled)
VALUES (
  'pri_whats_cadencia_completa',
  'Cadência Completa (IA WhatsApp)',
  'Habilita a opção de cadência completa na criação de eventos IA WhatsApp, com horários fixos (48h, 24h antes do evento e 4h após disparo).',
  'Prospecção',
  false
)
ON CONFLICT (flag_key) DO NOTHING;

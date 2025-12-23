-- Adicionar colunas para armazenar resposta do webhook do Meta
ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS template_id_pri text,
ADD COLUMN IF NOT EXISTS id_meta text,
ADD COLUMN IF NOT EXISTS status_meta text,
ADD COLUMN IF NOT EXISTS category_meta text;
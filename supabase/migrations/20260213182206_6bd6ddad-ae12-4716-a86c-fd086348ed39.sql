-- Change FK constraints on prospeccoes to SET NULL so templates can be deleted
ALTER TABLE public.prospeccoes DROP CONSTRAINT prospeccoes_template_prospeccao_id_fkey;
ALTER TABLE public.prospeccoes ADD CONSTRAINT prospeccoes_template_prospeccao_id_fkey 
  FOREIGN KEY (template_prospeccao_id) REFERENCES whatsapp_templates(id) ON DELETE SET NULL;

ALTER TABLE public.prospeccoes DROP CONSTRAINT prospeccoes_template_agendado_id_fkey;
ALTER TABLE public.prospeccoes ADD CONSTRAINT prospeccoes_template_agendado_id_fkey 
  FOREIGN KEY (template_agendado_id) REFERENCES whatsapp_templates(id) ON DELETE SET NULL;

ALTER TABLE public.prospeccoes DROP CONSTRAINT prospeccoes_template_nao_agendado_id_fkey;
ALTER TABLE public.prospeccoes ADD CONSTRAINT prospeccoes_template_nao_agendado_id_fkey 
  FOREIGN KEY (template_nao_agendado_id) REFERENCES whatsapp_templates(id) ON DELETE SET NULL;
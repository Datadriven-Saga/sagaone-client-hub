-- Renomear colunas de texto para _id (UUID)
-- Primeiro adicionar novas colunas UUID
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS template_prospeccao_id UUID REFERENCES public.whatsapp_templates(id),
ADD COLUMN IF NOT EXISTS template_agendado_id UUID REFERENCES public.whatsapp_templates(id),
ADD COLUMN IF NOT EXISTS template_nao_agendado_id UUID REFERENCES public.whatsapp_templates(id);

-- Migrar dados existentes: buscar ID pelo nome do template
UPDATE public.prospeccoes p
SET template_prospeccao_id = (
  SELECT wt.id FROM public.whatsapp_templates wt 
  WHERE wt.nome = p.template_prospeccao 
  AND wt.empresa_id = p.empresa_id
  LIMIT 1
)
WHERE p.template_prospeccao IS NOT NULL AND p.template_prospeccao != '';

UPDATE public.prospeccoes p
SET template_agendado_id = (
  SELECT wt.id FROM public.whatsapp_templates wt 
  WHERE wt.nome = p.template_agendado 
  AND wt.empresa_id = p.empresa_id
  LIMIT 1
)
WHERE p.template_agendado IS NOT NULL AND p.template_agendado != '';

UPDATE public.prospeccoes p
SET template_nao_agendado_id = (
  SELECT wt.id FROM public.whatsapp_templates wt 
  WHERE wt.nome = p.template_nao_agendado 
  AND wt.empresa_id = p.empresa_id
  LIMIT 1
)
WHERE p.template_nao_agendado IS NOT NULL AND p.template_nao_agendado != '';

-- Remover colunas antigas de texto
ALTER TABLE public.prospeccoes 
DROP COLUMN IF EXISTS template_prospeccao,
DROP COLUMN IF EXISTS template_agendado,
DROP COLUMN IF EXISTS template_nao_agendado;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_prospeccoes_template_prospeccao_id ON public.prospeccoes(template_prospeccao_id);
CREATE INDEX IF NOT EXISTS idx_prospeccoes_template_agendado_id ON public.prospeccoes(template_agendado_id);
CREATE INDEX IF NOT EXISTS idx_prospeccoes_template_nao_agendado_id ON public.prospeccoes(template_nao_agendado_id);
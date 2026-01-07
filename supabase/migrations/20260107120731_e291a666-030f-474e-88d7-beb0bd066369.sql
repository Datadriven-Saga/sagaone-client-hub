-- Adicionar coluna agente_id na tabela whatsapp_templates para vincular templates a um agente (PRI)
-- Isso permite que lojas que compartilham o mesmo agente vejam os mesmos templates

ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS agente_id UUID REFERENCES public.agentes_ia(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas buscas por agente
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_agente_id ON public.whatsapp_templates(agente_id);

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_templates.agente_id IS 'ID do agente IA (PRI) associado ao template. Lojas que compartilham o mesmo agente verão os mesmos templates.';
-- Adicionar campo pri_telefone na tabela whatsapp_templates
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS pri_telefone text;

-- Criar índice para busca por pri_telefone
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_pri_telefone 
ON public.whatsapp_templates(pri_telefone);

-- Atualizar templates existentes com o pri_telefone baseado no agente da empresa
UPDATE public.whatsapp_templates wt
SET pri_telefone = (
  SELECT ai.telefone 
  FROM agentes_ia ai 
  WHERE ai.empresa_id = wt.empresa_id 
    AND LOWER(ai.nome) LIKE '%pri%'
    AND ai.telefone IS NOT NULL
    AND ai.telefone != ''
  LIMIT 1
)
WHERE wt.pri_telefone IS NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_templates.pri_telefone IS 'Telefone da PRI - chave principal para compartilhamento de templates entre lojas';
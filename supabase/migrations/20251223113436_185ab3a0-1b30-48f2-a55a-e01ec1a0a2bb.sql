-- Deletar todos os templates TT3
DELETE FROM public.whatsapp_templates WHERE LOWER(nome) = 'tt3';

-- Manter apenas o template mais recente de 'douglas video' e deletar os outros
DELETE FROM public.whatsapp_templates 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id, LOWER(nome) ORDER BY created_at DESC) as rn
    FROM public.whatsapp_templates
    WHERE LOWER(nome) = 'douglas video'
  ) sub
  WHERE rn > 1
);

-- Agora criar o índice único
CREATE UNIQUE INDEX idx_whatsapp_templates_nome_empresa 
ON public.whatsapp_templates (empresa_id, LOWER(nome));
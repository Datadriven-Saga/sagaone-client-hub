-- Adicionar coluna variable_mapping para armazenar mapeamento de variáveis
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS variable_mapping JSONB DEFAULT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.whatsapp_templates.variable_mapping IS 'Mapeamento de variáveis numéricas para campos de dados (ex: {1: "nome_cliente", 2: "empresa"})';
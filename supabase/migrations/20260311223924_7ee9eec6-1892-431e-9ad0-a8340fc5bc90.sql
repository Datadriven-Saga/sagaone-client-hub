ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS exemplos_variaveis jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_templates.exemplos_variaveis IS 'Mapeamento de variáveis para exemplos usados na criação do template na Meta. Ex: {"1": "João", "2": "Toyota Corolla"}';
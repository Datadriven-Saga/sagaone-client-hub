-- Adicionar novos campos na tabela prospeccoes para configuração de IA Whatsapp
ALTER TABLE public.prospeccoes
ADD COLUMN IF NOT EXISTS evento_principal boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS qualificar_lead boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS data_envio_template_inicial timestamp with time zone,
ADD COLUMN IF NOT EXISTS data_envio_cadencia timestamp with time zone;

-- Comentários descritivos
COMMENT ON COLUMN public.prospeccoes.evento_principal IS 'Define se o lead será criado nesse evento por padrão quando falar com a PRI';
COMMENT ON COLUMN public.prospeccoes.qualificar_lead IS 'Define se o lead será qualificado para loja após confirmação. Se false, fica na central com tag CONFIRMADO';
COMMENT ON COLUMN public.prospeccoes.data_envio_template_inicial IS 'Data/hora do envio do template inicial de prospecção';
COMMENT ON COLUMN public.prospeccoes.data_envio_cadencia IS 'Data/hora do envio da cadência/confirmação';
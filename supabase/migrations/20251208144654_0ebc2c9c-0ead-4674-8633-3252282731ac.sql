-- Adicionar colunas de premiações na tabela prospeccoes

-- Premiações para Equipes
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS premio_equipe_campea numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_equipe_2lugar numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_equipe_3lugar numeric DEFAULT NULL;

-- Premiações para Vendedores
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS premio_vendedor_ouro numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_vendedor_prata numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_vendedor_bronze numeric DEFAULT NULL;

-- Premiação para Vendedor Prospector
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS premio_prospector_ouro numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_prospector_prata numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_prospector_bronze numeric DEFAULT NULL;

-- Premiações para Equipe de Apoio
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS premio_checkin_ouro numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_checkin_prata numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_checkin_bronze numeric DEFAULT NULL;

-- Premiações por Participação ou Indicação
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS premio_participacao_apoio numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS premio_indicacao_venda numeric DEFAULT NULL;
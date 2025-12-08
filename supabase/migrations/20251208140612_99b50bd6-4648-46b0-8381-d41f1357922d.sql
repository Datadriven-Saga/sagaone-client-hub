-- Adicionar campos de metas na tabela prospeccoes
ALTER TABLE public.prospeccoes
ADD COLUMN IF NOT EXISTS meta_novos integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_seminovos integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_diretas integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_checkins integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_confirmacoes integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_convites integer DEFAULT NULL;
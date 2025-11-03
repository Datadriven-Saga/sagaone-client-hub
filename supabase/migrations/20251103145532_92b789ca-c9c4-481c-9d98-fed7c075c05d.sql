-- Adicionar novos campos de template na tabela prospeccoes
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS template_prospeccao TEXT,
ADD COLUMN IF NOT EXISTS template_agendado TEXT,
ADD COLUMN IF NOT EXISTS template_nao_agendado TEXT;

-- Remover campos antigos que não serão mais utilizados
ALTER TABLE public.prospeccoes 
DROP COLUMN IF EXISTS local_evento,
DROP COLUMN IF EXISTS condicoes_especiais,
DROP COLUMN IF EXISTS objetivo_vendas;
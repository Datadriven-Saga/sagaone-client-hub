-- Adicionar coluna convite para campanhas de ligação
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS convite text;
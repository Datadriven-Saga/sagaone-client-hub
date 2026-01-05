-- Adicionar campo event_id_pri na tabela prospeccoes para armazenar o ID retornado do webhook PRI
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS event_id_pri TEXT;
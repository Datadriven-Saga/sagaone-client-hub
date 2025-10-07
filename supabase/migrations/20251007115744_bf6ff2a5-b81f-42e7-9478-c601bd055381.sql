-- Adicionar coluna dealer_id na tabela agentes_ia
ALTER TABLE public.agentes_ia 
ADD COLUMN dealer_id TEXT;

-- Preencher todos os agentes existentes com o DealerID 1234
UPDATE public.agentes_ia 
SET dealer_id = '1234' 
WHERE dealer_id IS NULL;
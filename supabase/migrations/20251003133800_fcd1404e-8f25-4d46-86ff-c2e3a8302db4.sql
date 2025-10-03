-- Adicionar coluna obrigatorio na tabela agente_variaveis
ALTER TABLE public.agente_variaveis
ADD COLUMN obrigatorio boolean NOT NULL DEFAULT false;
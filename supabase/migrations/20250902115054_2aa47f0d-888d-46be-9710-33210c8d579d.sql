-- Adicionar novos campos na tabela prospeccoes
ALTER TABLE public.prospeccoes 
ADD COLUMN local_evento text,
ADD COLUMN condicoes_especiais text,
ADD COLUMN objetivo_vendas text,
ADD COLUMN imagem_divulgacao_url text;
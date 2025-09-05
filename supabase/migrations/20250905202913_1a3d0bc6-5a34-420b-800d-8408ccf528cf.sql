-- Remover tabelas exclusivas dos módulos excluídos

-- Tabelas do módulo Loja
DROP TABLE IF EXISTS public.itens_venda CASCADE;
DROP TABLE IF EXISTS public.vendas CASCADE;

-- Tabela do módulo Metas e OKR
DROP TABLE IF EXISTS public.metas CASCADE;

-- Comentário: 
-- Central de Atendimento e Busca e Resgate não possuem tabelas exclusivas,
-- eles utilizam as tabelas gerais como contatos, prospeccoes, etc.
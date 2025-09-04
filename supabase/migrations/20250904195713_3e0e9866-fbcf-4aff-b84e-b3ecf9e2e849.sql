-- Limpar todos os dados de contatos, prospecções e relacionados para recomeçar
DELETE FROM public.eventos_prospeccao;
DELETE FROM public.logs_movimentacao_contatos;  
DELETE FROM public.contatos;
DELETE FROM public.prospeccoes;
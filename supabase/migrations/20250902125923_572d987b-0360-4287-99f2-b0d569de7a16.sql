-- Renomear tabela leads para contatos
ALTER TABLE public.leads RENAME TO contatos;

-- Renomear coluna na tabela logs_movimentacao_leads
ALTER TABLE public.logs_movimentacao_leads RENAME COLUMN lead_id TO contato_id;

-- Renomear a própria tabela de logs para ficar consistente
ALTER TABLE public.logs_movimentacao_leads RENAME TO logs_movimentacao_contatos;

-- Renomear coluna na tabela eventos_prospeccao
ALTER TABLE public.eventos_prospeccao RENAME COLUMN lead_id TO contato_id;

-- Renomear coluna na tabela notificacoes
ALTER TABLE public.notificacoes RENAME COLUMN lead_id TO contato_id;
-- Remover TODAS as políticas RLS das tabelas de prospecção
ALTER TABLE prospeccoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE contatos DISABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_prospeccao DISABLE ROW LEVEL SECURITY;
ALTER TABLE logs_movimentacao_contatos DISABLE ROW LEVEL SECURITY;

-- Dropar todas as políticas existentes
DROP POLICY IF EXISTS "prospeccoes_empresa_users" ON prospeccoes;
DROP POLICY IF EXISTS "contatos_empresa_users" ON contatos;
DROP POLICY IF EXISTS "logs_movimentacao_empresa_users" ON logs_movimentacao_contatos;
DROP POLICY IF EXISTS "eventos_prospeccao_empresa_users" ON eventos_prospeccao;
DROP POLICY IF EXISTS "eventos_prospeccao_company_users" ON eventos_prospeccao;
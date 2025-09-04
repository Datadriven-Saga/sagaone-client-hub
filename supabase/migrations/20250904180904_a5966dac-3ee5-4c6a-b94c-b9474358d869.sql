-- Limpar todas as tabelas de prospecção
DELETE FROM eventos_prospeccao;
DELETE FROM logs_movimentacao_contatos;
DELETE FROM contatos;
DELETE FROM prospeccoes;

-- Resetar sequences se necessário
-- Não aplicável para UUIDs

-- Verificar e corrigir as políticas RLS para separação correta por empresa
DROP POLICY IF EXISTS "prospeccoes_simple_access" ON prospeccoes;
DROP POLICY IF EXISTS "contatos_simple_access" ON contatos;
DROP POLICY IF EXISTS "logs_movimentacao_simple_access" ON logs_movimentacao_contatos;

-- Criar políticas RLS baseadas na empresa ativa do usuário (como no módulo de Acessos)
CREATE POLICY "prospeccoes_empresa_users" ON prospeccoes
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "contatos_empresa_users" ON contatos
FOR ALL 
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "logs_movimentacao_empresa_users" ON logs_movimentacao_contatos
FOR ALL 
USING (prospeccao_id IN (
  SELECT id FROM prospeccoes WHERE empresa_id = get_user_active_company(auth.uid())
))
WITH CHECK (prospeccao_id IN (
  SELECT id FROM prospeccoes WHERE empresa_id = get_user_active_company(auth.uid())
));

CREATE POLICY "eventos_prospeccao_empresa_users" ON eventos_prospeccao
FOR ALL 
USING (prospeccao_id IN (
  SELECT id FROM prospeccoes WHERE empresa_id = get_user_active_company(auth.uid())
))
WITH CHECK (prospeccao_id IN (
  SELECT id FROM prospeccoes WHERE empresa_id = get_user_active_company(auth.uid())
));
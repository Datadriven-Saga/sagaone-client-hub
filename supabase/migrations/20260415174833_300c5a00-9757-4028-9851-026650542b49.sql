
-- 1. Nova feature flag per_empresa
INSERT INTO system_feature_flags (flag_key, flag_label, description, category, scope, is_enabled)
VALUES (
  'webhook_movimentacao_lead',
  'Webhook Movimentação de Lead',
  'Dispara webhook externo quando vendedor move lead no Kanban (exceto eventos IA/Ligação). Ativado por loja.',
  'Prospecção',
  'per_empresa',
  false
);

-- 2. Coluna de controle no contato
ALTER TABLE contatos
ADD COLUMN webhook_ativado boolean DEFAULT false;

COMMENT ON COLUMN contatos.webhook_ativado IS
  'Marca se o primeiro disparo de webhook (status Em Espera) já aconteceu para este contato';

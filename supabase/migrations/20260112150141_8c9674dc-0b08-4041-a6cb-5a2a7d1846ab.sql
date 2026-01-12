-- Delete related records first (foreign key constraints)
DELETE FROM agente_empresas WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_cadencias WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_cadencias_steps WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_followups WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_integracoes WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_variaveis WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

DELETE FROM agente_performance WHERE agente_id IN (
  SELECT id FROM agentes_ia WHERE telefone LIKE '(%)%'
);

-- Now delete the manual agents (phone starting with parenthesis = manually formatted)
DELETE FROM agentes_ia WHERE telefone LIKE '(%)%';
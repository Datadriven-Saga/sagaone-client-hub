-- Delete related data first to avoid foreign key errors
DELETE FROM agente_cadencias WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_cadencias_steps WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_followups WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_integracoes WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_variaveis WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_performance WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

DELETE FROM agente_empresas WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE (persona IS NOT NULL AND persona != '')
     OR (cerebro IS NOT NULL AND cerebro != '')
);

-- Now delete the agents with persona or cerebro filled
DELETE FROM agentes_ia 
WHERE (persona IS NOT NULL AND persona != '')
   OR (cerebro IS NOT NULL AND cerebro != '');
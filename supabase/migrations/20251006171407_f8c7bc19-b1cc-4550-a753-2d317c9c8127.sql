-- Atualizar nomes das cadências do agente Maia
UPDATE public.agente_cadencias_steps
SET nome_cadencia = CASE nome_cadencia
  WHEN 'Cadência 1' THEN 'Dia 0: 1 hora sem resposta'
  WHEN 'Cadência 2' THEN 'Dia 0: 2 horas sem resposta'
  WHEN 'Cadência 3' THEN 'Dia 0: 3 horas sem resposta'
  WHEN 'Cadência 4' THEN 'Dia 0: 4 horas sem resposta'
  WHEN 'Cadência 5' THEN '1 dia sem resposta'
  WHEN 'Cadência 6' THEN '2 dias sem resposta'
  WHEN 'Cadência 7' THEN '3 dias sem resposta'
  WHEN 'Cadência 8' THEN '4 dias sem resposta'
  WHEN 'Cadência 9' THEN '5 dias sem resposta'
  WHEN 'Cadência 10' THEN '6 dias sem resposta'
  WHEN 'Cadência 11' THEN '7 dias sem resposta'
  ELSE nome_cadencia
END
WHERE nome_cadencia IN (
  'Cadência 1', 'Cadência 2', 'Cadência 3', 'Cadência 4', 'Cadência 5',
  'Cadência 6', 'Cadência 7', 'Cadência 8', 'Cadência 9', 'Cadência 10', 'Cadência 11'
);
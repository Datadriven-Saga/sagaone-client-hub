-- Excluir follow-ups "DIspara Prospeção" dos agentes Maia, Gaia e Bia
DELETE FROM agente_followups 
WHERE id IN (
  SELECT af.id
  FROM agente_followups af
  JOIN agentes_ia ai ON af.agente_id = ai.id
  WHERE af.nome ILIKE '%dispara%prospec%'
  AND ai.nome IN ('Maia', 'Gaia', 'Bia')
);
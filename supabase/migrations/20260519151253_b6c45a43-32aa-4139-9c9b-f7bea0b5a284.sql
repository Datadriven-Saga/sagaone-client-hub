WITH leads_pri AS (
  SELECT DISTINCT contato_id AS id
  FROM logs_movimentacao_contatos
  WHERE usuario_id = (SELECT id FROM auth.users WHERE email='pri.ia@sagadatadriven.com.br')
    AND prospeccao_id = 'cf0f2db2-7bda-43be-86fe-0d596874c7a8'
  UNION
  SELECT DISTINCT c.id
  FROM contatos c
  JOIN eventos_prospeccao ep ON ep.contato_id = c.id
  WHERE ep.prospeccao_id = 'cf0f2db2-7bda-43be-86fe-0d596874c7a8'
    AND c.responsavel_email = 'pri.ia@sagadatadriven.com.br'
)
UPDATE public.contatos c
SET agente_ia = array_append(agente_ia, 'pri'),
    updated_at = now()
FROM leads_pri lp
WHERE c.id = lp.id
  AND NOT ('pri' = ANY(c.agente_ia));
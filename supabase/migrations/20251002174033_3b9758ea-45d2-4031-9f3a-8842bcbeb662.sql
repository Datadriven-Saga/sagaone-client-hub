-- Ativar variáveis específicas para Maia apenas em empresas VW e Hyundai
UPDATE agente_variaveis av
SET ativo = true, updated_at = now()
WHERE av.nome IN ('Veiculo Usado da Troca', 'Modelo e Ano do Veículo Usado')
AND av.agente_id IN (
  SELECT ai.id 
  FROM agentes_ia ai
  JOIN empresas e ON ai.empresa_id = e.id
  WHERE ai.nome = 'Maia'
  AND (
    e.marca ILIKE '%volkswagen%' 
    OR e.marca ILIKE '%vw%' 
    OR e.marca ILIKE '%hyundai%'
  )
);
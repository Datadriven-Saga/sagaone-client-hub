-- Atualizar dealer_id dos agentes Maia com o crm_id da empresa
UPDATE agentes_ia
SET dealer_id = empresas.crm_id,
    updated_at = now()
FROM empresas
WHERE agentes_ia.empresa_id = empresas.id
  AND agentes_ia.nome = 'Maia'
  AND empresas.crm_id IS NOT NULL;
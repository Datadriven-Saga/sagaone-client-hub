-- Ativar variáveis específicas para Maia nas empresas Volkswagen e Hyundai
UPDATE agente_variaveis av
SET ativo = true, updated_at = now()
WHERE av.nome IN ('Veiculo Usado da Troca', 'Modelo e Ano do Veículo Usado')
AND av.agente_id IN (
  SELECT ai.id 
  FROM agentes_ia ai
  WHERE ai.nome = 'Maia'
  AND ai.empresa_id IN (
    '49547b12-7063-4ecd-b7ec-71d06a4556cf', -- Saga Volkswagen BSB
    '3d21c93b-fa21-47dd-87ac-cd5eeb18b607', -- Saga Volkswagen Gama
    '82c1e6e0-2cc1-48d7-9f5e-feaf0291643a', -- Saga Volkswagen PVH
    'f585c657-f83f-44a8-bfa4-3a034eb63fb1', -- Saga Volkswagen T7
    '1f98c0ef-b75c-4a08-914a-31a376a0c02d', -- SAGA VOLKSWAGEN UDI
    'f9e110eb-365c-4256-9345-77a7186ef182', -- Saga Hyundai HMB Anápolis
    'aa597090-84da-4866-bd6e-4b5a6471ddb9', -- Saga Hyundai HMB Cidade Jardim
    '84b21f47-e870-4990-96bb-9dd038f1cbdc', -- Saga Hyundai HMB Pantanal
    'a071c48c-1dac-496a-840e-b99b54153a0e', -- Saga Hyundai HMB PVH
    'd3cded60-c5d6-4925-a1a2-8b51699c95a4', -- Saga Hyundai HMB SIA
    'e2c4fdf8-6d24-402e-8dc4-8e5488bedbfa', -- Saga Hyundai HMB T9
    '686f5cce-76b1-4029-8869-b715d155c32d', -- Saga Hyundai HMB Taguatinga
    'ea2bf644-1c6b-49a7-9457-f49c42a6ed3f'  -- Saga Hyundai HMB VGD
  )
);
-- Atualizar a venda para usar o departamento "Vendas" correto
UPDATE vendas_prospeccao 
SET departamento_id = '06f18557-a8ad-450a-9bc6-55e55a2a0f1b'
WHERE departamento_id = 'bc4aa87a-c7a6-4fa7-b17a-3d5186f77d20';

-- Excluir o departamento duplicado "vendas" (modelo Manual)
DELETE FROM departamentos WHERE id = 'bc4aa87a-c7a6-4fa7-b17a-3d5186f77d20';
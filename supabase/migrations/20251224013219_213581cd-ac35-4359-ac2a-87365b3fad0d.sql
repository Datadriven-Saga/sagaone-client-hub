INSERT INTO departamentos (empresa_id, nome, modelo_distribuicao, ativo)
SELECT e.id, d.nome, 'Fila de Vendedores', true
FROM empresas e
CROSS JOIN (
  SELECT 'Vendas' as nome UNION ALL
  SELECT 'Vendas Digitais' UNION ALL
  SELECT 'Consórcio' UNION ALL
  SELECT 'Pós-Vendas' UNION ALL
  SELECT 'Peças' UNION ALL
  SELECT 'Acessórios'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM departamentos dep 
  WHERE dep.empresa_id = e.id AND dep.nome = d.nome
);
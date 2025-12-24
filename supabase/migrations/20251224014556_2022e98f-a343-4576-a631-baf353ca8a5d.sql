
-- Inserir 5 temperaturas em todas as empresas que ainda não as têm

-- Temperatura 1: Fervendo (vermelho)
INSERT INTO temperaturas_lead (nome, cor, ordem, ativo, empresa_id)
SELECT 'Fervendo', '#EF4444', 1, true, e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM temperaturas_lead t 
  WHERE t.empresa_id = e.id 
  AND t.nome = 'Fervendo'
);

-- Temperatura 2: Quente (laranja)
INSERT INTO temperaturas_lead (nome, cor, ordem, ativo, empresa_id)
SELECT 'Quente', '#F97316', 2, true, e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM temperaturas_lead t 
  WHERE t.empresa_id = e.id 
  AND t.nome = 'Quente'
);

-- Temperatura 3: Morno (amarelo)
INSERT INTO temperaturas_lead (nome, cor, ordem, ativo, empresa_id)
SELECT 'Morno', '#EAB308', 3, true, e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM temperaturas_lead t 
  WHERE t.empresa_id = e.id 
  AND t.nome = 'Morno'
);

-- Temperatura 4: Frio (azul)
INSERT INTO temperaturas_lead (nome, cor, ordem, ativo, empresa_id)
SELECT 'Frio', '#3B82F6', 4, true, e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM temperaturas_lead t 
  WHERE t.empresa_id = e.id 
  AND t.nome = 'Frio'
);

-- Temperatura 5: Congelando (cinza)
INSERT INTO temperaturas_lead (nome, cor, ordem, ativo, empresa_id)
SELECT 'Congelando', '#6B7280', 5, true, e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM temperaturas_lead t 
  WHERE t.empresa_id = e.id 
  AND t.nome = 'Congelando'
);

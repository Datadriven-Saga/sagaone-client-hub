-- Inserir contato Carina
INSERT INTO contatos (nome, telefone, status, origem, empresa_id)
VALUES ('Carina', '62996284723', 'Novo', 'ligacao', '8a7de62b-2cd1-4a77-9e29-c6721d94a065')
ON CONFLICT DO NOTHING
RETURNING id;

-- Vincular ao evento Mktour Ligação (prospeccao_id: 1c93d962-4e93-4c98-bedd-b817468d0af1)
INSERT INTO eventos_prospeccao (contato_id, prospeccao_id, tipo_evento)
SELECT c.id, '1c93d962-4e93-4c98-bedd-b817468d0af1', 'Contato Inicial'
FROM contatos c 
WHERE c.telefone = '62996284723' 
AND c.empresa_id = '8a7de62b-2cd1-4a77-9e29-c6721d94a065'
AND NOT EXISTS (
  SELECT 1 FROM eventos_prospeccao ep 
  WHERE ep.contato_id = c.id 
  AND ep.prospeccao_id = '1c93d962-4e93-4c98-bedd-b817468d0af1'
);
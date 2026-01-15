-- Adicionar constraint unique para evitar duplicatas de contato+evento
-- Primeiro, remover duplicatas existentes (mantendo apenas o primeiro registro)
DELETE FROM eventos_prospeccao a
USING eventos_prospeccao b
WHERE a.created_at > b.created_at
  AND a.contato_id = b.contato_id
  AND a.prospeccao_id = b.prospeccao_id;

-- Agora criar a constraint unique
ALTER TABLE eventos_prospeccao 
ADD CONSTRAINT eventos_prospeccao_contato_prospeccao_unique 
UNIQUE (contato_id, prospeccao_id);
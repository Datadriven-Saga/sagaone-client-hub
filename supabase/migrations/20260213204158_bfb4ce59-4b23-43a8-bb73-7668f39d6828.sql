
-- Apagar vínculos (eventos_prospeccao) dos contatos do evento 33 criados hoje que NÃO estão no banco externo
DELETE FROM eventos_prospeccao
WHERE prospeccao_id = 'b1f8c5df-5619-418a-a926-4fd4dd5d8b63'
  AND contato_id IN (
    SELECT c.id
    FROM contatos c
    WHERE c.created_at::date = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM prospect_pri_voz ppv 
        WHERE ppv.id_evento = 33 
        AND ppv.telefone_lead = c.telefone
      )
      AND EXISTS (
        SELECT 1 FROM eventos_prospeccao ep2 
        WHERE ep2.prospeccao_id = 'b1f8c5df-5619-418a-a926-4fd4dd5d8b63'
        AND ep2.contato_id = c.id
      )
  );

-- Apagar os contatos órfãos (criados hoje, sem vínculo com nenhum outro evento)
DELETE FROM contatos
WHERE created_at::date = CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM prospect_pri_voz ppv 
    WHERE ppv.id_evento = 33 
    AND ppv.telefone_lead = contatos.telefone
  )
  AND id IN (
    SELECT c2.id FROM contatos c2
    WHERE c2.created_at::date = CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM eventos_prospeccao ep3 WHERE ep3.contato_id = c2.id
    )
  );

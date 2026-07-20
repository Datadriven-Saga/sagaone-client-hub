
CREATE OR REPLACE FUNCTION public.reset_leads_evento_sem_log(p_prospeccao_id uuid)
RETURNS TABLE(logs_inseridos int, responsaveis_limpos int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs int := 0;
  v_resp int := 0;
BEGIN
  WITH alvos AS (
    SELECT DISTINCT ep.contato_id
    FROM eventos_prospeccao ep
    WHERE ep.prospeccao_id = p_prospeccao_id
      AND NOT EXISTS (
        SELECT 1 FROM logs_movimentacao_contatos l
        WHERE l.contato_id = ep.contato_id AND l.prospeccao_id = p_prospeccao_id
      )
  ),
  ins AS (
    INSERT INTO logs_movimentacao_contatos
      (contato_id, prospeccao_id, status_anterior, status_novo, data_movimentacao, observacoes)
    SELECT a.contato_id, p_prospeccao_id, NULL, 'Novo', now(),
           'Reset em massa: lead sem log específico do evento (correção 2026-07-20)'
    FROM alvos a
    RETURNING 1
  )
  SELECT count(*) INTO v_logs FROM ins;

  WITH alvos AS (
    SELECT DISTINCT ep.contato_id
    FROM eventos_prospeccao ep
    JOIN contatos c ON c.id = ep.contato_id
    WHERE ep.prospeccao_id = p_prospeccao_id
      AND c.responsavel_email IS NOT NULL
      AND c.responsavel_email NOT ILIKE 'pri.ia@%'
      AND c.responsavel_email NOT ILIKE '%@sistema%'
      AND NOT EXISTS (
        SELECT 1 FROM prospeccao_equipe_membros pem
        JOIN prospeccao_equipes pe ON pe.id = pem.equipe_id
        JOIN profiles pr ON pr.id = pem.user_id
        WHERE pe.prospeccao_id = p_prospeccao_id
          AND pr.email = c.responsavel_email
      )
      AND EXISTS (
        SELECT 1 FROM logs_movimentacao_contatos l
        WHERE l.contato_id = ep.contato_id
          AND l.prospeccao_id = p_prospeccao_id
          AND l.observacoes = 'Reset em massa: lead sem log específico do evento (correção 2026-07-20)'
      )
  ),
  upd AS (
    UPDATE contatos c
    SET responsavel_email = NULL, responsavel_nome = NULL
    FROM alvos a
    WHERE c.id = a.contato_id
    RETURNING 1
  )
  SELECT count(*) INTO v_resp FROM upd;

  RETURN QUERY SELECT v_logs, v_resp;
END;
$$;


-- Fase 1: auto_atribuir_leads_vendedor grava log por-evento e suprime trg_log_contato_status
CREATE OR REPLACE FUNCTION public.auto_atribuir_leads_vendedor(user_id_param uuid DEFAULT auth.uid())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  leads_pendentes integer;
  leads_a_atribuir integer;
  user_email text;
  user_nome text;
  empresa_id_param uuid;
  leads_atribuidos integer := 0;
BEGIN
  SELECT
    get_current_user_email(),
    p.nome_completo,
    get_user_active_company(user_id_param)
  INTO user_email, user_nome, empresa_id_param
  FROM profiles p
  WHERE p.id = user_id_param;

  leads_pendentes := count_vendedor_leads_pendentes(user_id_param);
  leads_a_atribuir := GREATEST(0, 30 - leads_pendentes);

  IF leads_a_atribuir <= 0 THEN
    RETURN 0;
  END IF;

  -- Materializa par (contato_id, prospeccao_id) — evento em que o SDR está pegando o lead
  CREATE TEMP TABLE IF NOT EXISTS _tmp_leads_pick (
    contato_id uuid PRIMARY KEY,
    prospeccao_id uuid NOT NULL
  ) ON COMMIT DROP;
  DELETE FROM _tmp_leads_pick;

  INSERT INTO _tmp_leads_pick (contato_id, prospeccao_id)
  SELECT DISTINCT ON (c.id) c.id, ep.prospeccao_id
  FROM contatos c
  INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
  INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id
    AND pr.empresa_id = empresa_id_param
    AND pr.canal IN ('Grande Evento', 'Mensal')
  WHERE c.empresa_id = empresa_id_param
    AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
    AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
    AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
    AND EXISTS (
      SELECT 1 FROM prospeccao_equipes eq
      JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
      WHERE eq.prospeccao_id = ep.prospeccao_id
        AND em.user_id = user_id_param
    )
  ORDER BY c.id, ep.created_at DESC
  LIMIT leads_a_atribuir;

  -- Suprime trigger defensivo — vamos logar explicitamente com o prospeccao_id correto
  PERFORM set_config('app.status_change_logged', 'true', true);

  UPDATE contatos c
     SET responsavel_email = user_email,
         vendedor_nome     = user_nome,
         status            = 'Atribuído'::status_lead,
         updated_at        = now()
    FROM _tmp_leads_pick t
   WHERE c.id = t.contato_id;

  GET DIAGNOSTICS leads_atribuidos = ROW_COUNT;

  -- Log explícito por-evento (única fonte de verdade do webhook movimentacao_lead_kanban)
  INSERT INTO logs_movimentacao_contatos
    (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes)
  SELECT t.contato_id, t.prospeccao_id, 'Novo', 'Atribuído', user_id_param,
         'auto-atribuição SDR/Vendedor'
  FROM _tmp_leads_pick t;

  RETURN leads_atribuidos;
END;
$function$;

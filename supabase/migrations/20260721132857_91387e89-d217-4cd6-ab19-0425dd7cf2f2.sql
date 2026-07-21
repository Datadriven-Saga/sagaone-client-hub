
-- Fase 2: mutate_contato_status_atomic vira SECURITY DEFINER com validação interna
CREATE OR REPLACE FUNCTION public.mutate_contato_status_atomic(
  p_contato uuid, p_novo text, p_anterior text, p_prospeccao uuid, p_usuario uuid, p_obs text
)
RETURNS TABLE(contato_id uuid, status_anterior text, status_novo text, updated_at timestamptz, log_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_at timestamptz;
  v_log_inserted boolean := false;
  v_caller uuid := auth.uid();
  v_empresa uuid;
  v_email_contato text;
  v_email_caller text;
  v_is_admin boolean := false;
  v_is_team boolean := false;
BEGIN
  -- 1) Autorização — bypass total apenas para service_role (edges internas)
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'sem sessão autenticada' USING ERRCODE = '42501';
    END IF;

    -- 1a) Admin/Master bypass
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_caller
        AND tipo_acesso IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso)
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      -- 1b) Empresa do contato precisa ser acessível
      SELECT empresa_id, responsavel_email INTO v_empresa, v_email_contato
        FROM public.contatos WHERE id = p_contato;

      IF v_empresa IS NULL THEN
        RAISE EXCEPTION 'Contato % nao encontrado', p_contato USING ERRCODE = 'P0002';
      END IF;

      IF NOT public.user_can_access_empresa(v_empresa, v_caller) THEN
        RAISE EXCEPTION 'sem acesso à empresa do contato' USING ERRCODE = '42501';
      END IF;

      -- 1c) Precisa ser responsável do lead OU membro da equipe do evento
      v_email_caller := public.get_current_user_email();

      IF p_prospeccao IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
            FROM public.prospeccao_equipes eq
            JOIN public.prospeccao_equipe_membros em ON em.equipe_id = eq.id
           WHERE eq.prospeccao_id = p_prospeccao
             AND em.user_id = v_caller
        ) INTO v_is_team;
      END IF;

      IF NOT v_is_team
         AND (v_email_contato IS NULL
              OR v_email_caller IS NULL
              OR lower(v_email_contato) <> lower(v_email_caller)) THEN
        RAISE EXCEPTION 'sem permissão para movimentar este lead' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- 2) Mutação (suprime trg_log_contato_status; logamos explicitamente abaixo)
  PERFORM set_config('app.status_change_logged', 'true', true);

  UPDATE public.contatos
     SET status = p_novo::status_lead,
         updated_at = now()
   WHERE id = p_contato
   RETURNING contatos.updated_at INTO v_updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % nao encontrado', p_contato USING ERRCODE = 'P0002';
  END IF;

  IF p_prospeccao IS NOT NULL THEN
    INSERT INTO public.logs_movimentacao_contatos
      (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes)
    VALUES
      (p_contato, p_prospeccao, p_anterior, p_novo, p_usuario, p_obs);
    v_log_inserted := true;
  END IF;

  RETURN QUERY SELECT p_contato, p_anterior, p_novo, v_updated_at, v_log_inserted;
END;
$function$;

COMMENT ON FUNCTION public.mutate_contato_status_atomic IS
  'Fase 2 (2026-07-21): SECURITY DEFINER com validação interna (empresa + responsável/equipe). service_role bypass. Continua setando app.status_change_logged para suprimir trg_log_contato_status.';

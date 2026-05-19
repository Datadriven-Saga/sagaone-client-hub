
CREATE OR REPLACE FUNCTION public.mutate_contato_status_atomic(
  p_contato uuid,
  p_novo text,
  p_anterior text,
  p_prospeccao uuid,
  p_usuario uuid,
  p_obs text
)
RETURNS TABLE (
  contato_id uuid,
  status_anterior text,
  status_novo text,
  updated_at timestamptz,
  log_inserted boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated_at timestamptz;
  v_log_inserted boolean := false;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.mutate_contato_status_atomic(uuid, text, text, uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_contato_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prosp uuid;
  v_flag text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_flag := current_setting('app.status_change_logged', true);

    IF coalesce(v_flag, 'false') <> 'true' THEN
      SELECT prospeccao_id INTO v_prosp
        FROM public.eventos_prospeccao
       WHERE contato_id = NEW.id
       ORDER BY created_at DESC
       LIMIT 1;

      IF v_prosp IS NOT NULL THEN
        INSERT INTO public.logs_movimentacao_contatos
          (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes)
        VALUES
          (NEW.id, v_prosp, OLD.status::text, NEW.status::text, auth.uid(),
           'auto-trigger (fallback de migracao)');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contato_status ON public.contatos;

CREATE TRIGGER trg_log_contato_status
AFTER UPDATE OF status ON public.contatos
FOR EACH ROW
EXECUTE FUNCTION public.log_contato_status_change();

COMMENT ON FUNCTION public.mutate_contato_status_atomic IS
  'PR 0: ponto canonico para mutacao de contatos.status. Seta flag app.status_change_logged para silenciar trg_log_contato_status.';

COMMENT ON FUNCTION public.log_contato_status_change IS
  'PR 0: trigger defensivo. Loga UPDATE de status quando a rota nao setou app.status_change_logged. Remover apos migracao completa dos call sites.';

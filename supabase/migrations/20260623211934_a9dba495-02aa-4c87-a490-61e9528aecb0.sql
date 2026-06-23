
CREATE OR REPLACE FUNCTION public.cancel_scheduled_campaign_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job record;
  v_cancelled_batches int := 0;
  v_kept_processing int := 0;
  v_uid uuid := auth.uid();
BEGIN
  SELECT cj.* INTO v_job FROM public.campaign_jobs cj WHERE cj.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Passar v_uid explicitamente desambigua o overload de user_can_access_empresa
  -- (existem assinaturas (uuid) e (uuid, uuid DEFAULT auth.uid()) — intencionais).
  IF v_uid IS NULL OR NOT public.user_can_access_empresa(v_job.empresa_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF v_job.cancelled_at IS NOT NULL OR v_job.status NOT IN ('scheduled','processing','partially_completed') THEN
    RAISE EXCEPTION 'Job não pode ser cancelado (status atual: %)', v_job.status USING ERRCODE = '22023';
  END IF;

  -- campaign_batches_status_check NÃO aceita 'cancelled' — usar 'failed' com error_log.
  UPDATE public.campaign_batches
     SET status = 'failed',
         error_log = 'Cancelado pelo usuário',
         updated_at = now()
   WHERE job_id = p_job_id AND status = 'scheduled';
  GET DIAGNOSTICS v_cancelled_batches = ROW_COUNT;

  SELECT count(*) INTO v_kept_processing
    FROM public.campaign_batches
   WHERE job_id = p_job_id AND status = 'processing';

  UPDATE public.campaign_jobs
     SET status = CASE WHEN v_kept_processing > 0 THEN 'processing' ELSE 'cancelled' END,
         cancelled_at = now(),
         cancelled_by = v_uid,
         updated_at = now()
   WHERE id = p_job_id;

  BEGIN
    INSERT INTO public.logs_disparos (
      job_id, prospeccao_id, empresa_id, canal,
      origem, total_contatos, total_sucesso, total_falha,
      evento_nome, usuario_id
    ) VALUES (
      p_job_id, v_job.prospeccao_id, v_job.empresa_id, v_job.canal,
      'edge_function', 0, 0, 0,
      'Cancelamento de disparo programado', v_uid
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'cancelled_batches', v_cancelled_batches,
    'kept_processing', v_kept_processing,
    'final_status', CASE WHEN v_kept_processing > 0 THEN 'processing' ELSE 'cancelled' END
  );
END;
$function$;

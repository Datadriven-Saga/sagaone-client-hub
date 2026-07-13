
UPDATE public.campaign_jobs
SET status='cancelled',
    completed_at=now(),
    error_message='Cancelado manualmente pelo administrador (disparo travado).'
WHERE id IN ('91d4a3f1-acfa-45ff-8963-8afbdf28f389','1c0c246b-d4b2-43d9-ac53-e2ac1393d68c');

UPDATE public.campaign_batches
SET status='failed',
    error_log='Cancelado manualmente (job cancelado)'
WHERE job_id IN ('91d4a3f1-acfa-45ff-8963-8afbdf28f389','1c0c246b-d4b2-43d9-ac53-e2ac1393d68c')
  AND status IN ('pending','processing','scheduled');

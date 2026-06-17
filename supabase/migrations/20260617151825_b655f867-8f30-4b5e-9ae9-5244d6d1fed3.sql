ALTER TABLE public.campaign_jobs DROP CONSTRAINT campaign_jobs_status_check;
ALTER TABLE public.campaign_jobs ADD CONSTRAINT campaign_jobs_status_check
  CHECK (status IN ('pending','processing','completed','failed','cancelled','scheduled'));

ALTER TABLE public.campaign_batches DROP CONSTRAINT campaign_batches_status_check;
ALTER TABLE public.campaign_batches ADD CONSTRAINT campaign_batches_status_check
  CHECK (status IN ('pending','processing','completed','failed','scheduled'));
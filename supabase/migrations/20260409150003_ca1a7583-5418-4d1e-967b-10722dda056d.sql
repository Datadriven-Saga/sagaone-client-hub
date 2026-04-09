
-- 1. Fix existing data: leads with status 'Novo' but responsavel_email set
-- should be 'Atribuído' so they appear in the vendor's Kanban
UPDATE public.contatos
SET status = 'Atribuído',
    updated_at = now()
WHERE status = 'Novo'
  AND responsavel_email IS NOT NULL
  AND responsavel_email <> '';

-- 2. Create trigger to prevent this from happening again on future imports
CREATE OR REPLACE FUNCTION public.auto_set_atribuido_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If a contact is being inserted with status 'Novo' but already has a responsavel_email,
  -- automatically set status to 'Atribuído'
  IF NEW.status = 'Novo' AND NEW.responsavel_email IS NOT NULL AND NEW.responsavel_email <> '' THEN
    NEW.status := 'Atribuído';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_atribuido ON public.contatos;
CREATE TRIGGER trg_auto_set_atribuido
  BEFORE INSERT ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_atribuido_on_insert();

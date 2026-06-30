
-- Normalize responsavel_email to lowercase in contatos
UPDATE public.contatos
SET responsavel_email = lower(responsavel_email)
WHERE responsavel_email IS NOT NULL
  AND responsavel_email <> lower(responsavel_email);

-- Trigger to enforce lowercase on insert/update
CREATE OR REPLACE FUNCTION public.normalize_contato_responsavel_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_email IS NOT NULL THEN
    NEW.responsavel_email := lower(NEW.responsavel_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_responsavel_email ON public.contatos;
CREATE TRIGGER trg_normalize_responsavel_email
BEFORE INSERT OR UPDATE OF responsavel_email ON public.contatos
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contato_responsavel_email();

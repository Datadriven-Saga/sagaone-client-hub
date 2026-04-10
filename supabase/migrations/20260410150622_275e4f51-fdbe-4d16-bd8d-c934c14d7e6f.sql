
CREATE OR REPLACE FUNCTION public.trg_auto_set_atribuido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a contact is being inserted with status 'Novo' and has a responsavel_email,
  -- only promote to 'Atribuído' if the email matches a real user in the system
  IF NEW.status = 'Novo' AND NEW.responsavel_email IS NOT NULL AND NEW.responsavel_email <> '' THEN
    IF EXISTS (
      SELECT 1 FROM auth.users WHERE email = NEW.responsavel_email
    ) THEN
      NEW.status := 'Atribuído';
    ELSE
      -- Email doesn't match any user, clear it so lead stays as 'Novo'
      NEW.responsavel_email := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

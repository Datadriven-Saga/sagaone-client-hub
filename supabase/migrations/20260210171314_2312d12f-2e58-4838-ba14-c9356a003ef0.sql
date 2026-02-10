
-- Auto-encrypt secrets on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_mfa_secret_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  enc_key bytea;
  test_decrypt text;
BEGIN
  -- Try to decrypt - if it works, it's already encrypted
  BEGIN
    enc_key := extensions.digest('mfa_totp_encryption_saga_one_2025_secure_key', 'sha256');
    test_decrypt := convert_from(extensions.decrypt(decode(NEW.secret_encrypted, 'base64'), enc_key, 'aes'), 'utf8');
    -- Already encrypted, leave as-is
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- Not encrypted yet, encrypt it
    NEW.secret_encrypted := public.encrypt_mfa_secret(NEW.secret_encrypted);
    RETURN NEW;
  END;
END;
$$;

CREATE TRIGGER encrypt_mfa_secret_before_upsert
BEFORE INSERT OR UPDATE OF secret_encrypted ON public.mfa_accounts
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_mfa_secret_trigger();

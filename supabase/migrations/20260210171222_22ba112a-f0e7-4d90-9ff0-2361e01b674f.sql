
-- Ensure pgcrypto is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Create a security definer function to encrypt TOTP secrets
CREATE OR REPLACE FUNCTION public.encrypt_mfa_secret(plain_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  enc_key bytea;
BEGIN
  -- Fixed 32-byte key for AES-256
  enc_key := extensions.digest('mfa_totp_encryption_saga_one_2025_secure_key', 'sha256');
  RETURN encode(extensions.encrypt(convert_to(plain_secret, 'utf8'), enc_key, 'aes'), 'base64');
END;
$$;

-- Create a security definer function to decrypt TOTP secrets  
CREATE OR REPLACE FUNCTION public.decrypt_mfa_secret(encrypted_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  enc_key bytea;
BEGIN
  enc_key := extensions.digest('mfa_totp_encryption_saga_one_2025_secure_key', 'sha256');
  RETURN convert_from(extensions.decrypt(decode(encrypted_secret, 'base64'), enc_key, 'aes'), 'utf8');
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails, return as-is (legacy unencrypted data)
  RETURN encrypted_secret;
END;
$$;

-- Create a secure view that decrypts secrets for the current user only
CREATE OR REPLACE VIEW public.mfa_accounts_decrypted
WITH (security_invoker = on)
AS
SELECT 
  id,
  issuer,
  label,
  public.decrypt_mfa_secret(secret_encrypted) as secret,
  algorithm,
  digits,
  period,
  user_id,
  created_by,
  created_at,
  updated_at
FROM public.mfa_accounts
WHERE user_id = auth.uid();

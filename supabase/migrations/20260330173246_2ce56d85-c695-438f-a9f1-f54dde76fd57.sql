
-- Recreate view without WHERE clause - RLS on mfa_password_vault handles access control
CREATE OR REPLACE VIEW public.mfa_password_vault_decrypted AS
SELECT 
  v.id,
  v.account_id,
  v.login,
  public.decrypt_mfa_secret(v.password_encrypted) AS password_plain,
  v.notes,
  v.created_by,
  v.created_at,
  v.updated_at
FROM public.mfa_password_vault v;

-- Ensure security_invoker is set
ALTER VIEW public.mfa_password_vault_decrypted SET (security_invoker = true);

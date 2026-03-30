
-- Add SELECT policy for users with active mfa_account_access to the linked account
CREATE POLICY "Users with account access can view vault"
ON public.mfa_password_vault
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mfa_account_access aa
    WHERE aa.account_id = mfa_password_vault.account_id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  )
);

-- Recreate the decrypted view to also show entries for users with account access
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
FROM public.mfa_password_vault v
WHERE 
  public.is_mfa_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.mfa_account_access aa
    WHERE aa.account_id = v.account_id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  );

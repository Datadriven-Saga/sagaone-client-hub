-- Restrict MFA account visibility for non-master users to explicit active access only.
-- Keep masters with full visibility.

DROP VIEW IF EXISTS public.mfa_accounts_decrypted;

CREATE VIEW public.mfa_accounts_decrypted
WITH (security_invoker = true) AS
SELECT
  ma.id,
  ma.issuer,
  ma.label,
  public.decrypt_mfa_secret(ma.secret_encrypted) AS secret,
  ma.algorithm,
  ma.digits,
  ma.period,
  ma.user_id,
  ma.created_by,
  ma.created_at,
  ma.updated_at
FROM public.mfa_accounts ma
WHERE
  public.is_mfa_master(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.mfa_account_access aa
    WHERE aa.account_id = ma.id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  );

-- Tighten base-table SELECT as well so non-master ownership alone does not grant read access.
DROP POLICY IF EXISTS "MFA accounts visibility" ON public.mfa_accounts;

CREATE POLICY "MFA accounts visibility"
ON public.mfa_accounts
FOR SELECT
USING (
  public.is_mfa_master(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.mfa_account_access aa
    WHERE aa.account_id = mfa_accounts.id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  )
);

-- Restrict recovery codes to master or explicit active access only.
DROP POLICY IF EXISTS "MFA recovery codes visibility" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Users can view their own recovery codes" ON public.mfa_recovery_codes;

CREATE POLICY "MFA recovery codes visibility"
ON public.mfa_recovery_codes
FOR SELECT
USING (
  public.is_mfa_master(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.mfa_account_access aa
    WHERE aa.account_id = mfa_recovery_codes.account_id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  )
);

-- Restrict vault reading to master or explicit active access only (already aligned, recreated for consistency).
DROP POLICY IF EXISTS "Users with account access can view vault" ON public.mfa_password_vault;
DROP POLICY IF EXISTS "MFA masters can view vault" ON public.mfa_password_vault;

CREATE POLICY "MFA masters can view vault"
ON public.mfa_password_vault
FOR SELECT
USING (public.is_mfa_master(auth.uid()));

CREATE POLICY "Users with account access can view vault"
ON public.mfa_password_vault
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.mfa_account_access aa
    WHERE aa.account_id = mfa_password_vault.account_id
      AND aa.user_id = auth.uid()
      AND aa.active = true
  )
);
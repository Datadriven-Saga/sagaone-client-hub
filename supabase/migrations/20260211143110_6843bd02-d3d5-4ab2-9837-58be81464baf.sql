
-- Fix the RLS SELECT policy: user should see accounts they OWN *or* have been ASSIGNED
DROP POLICY IF EXISTS "MFA accounts visibility" ON mfa_accounts;
CREATE POLICY "MFA accounts visibility" ON mfa_accounts
FOR SELECT USING (
  is_mfa_master(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM mfa_account_access aa
    WHERE aa.account_id = mfa_accounts.id
    AND aa.user_id = auth.uid()
    AND aa.active = true
  )
);

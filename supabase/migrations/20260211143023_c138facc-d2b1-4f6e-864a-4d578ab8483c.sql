
-- Drop and recreate the view to include assigned accounts
CREATE OR REPLACE VIEW public.mfa_accounts_decrypted
WITH (security_invoker = true)
AS
SELECT 
    ma.id,
    ma.issuer,
    ma.label,
    decrypt_mfa_secret(ma.secret_encrypted) AS secret,
    ma.algorithm,
    ma.digits,
    ma.period,
    ma.user_id,
    ma.created_by,
    ma.created_at,
    ma.updated_at
FROM mfa_accounts ma
WHERE 
    -- Master sees all
    is_mfa_master(auth.uid())
    -- Owner sees own
    OR ma.user_id = auth.uid()
    -- Assigned users see their assigned accounts
    OR EXISTS (
        SELECT 1 FROM mfa_account_access aa 
        WHERE aa.account_id = ma.id 
        AND aa.user_id = auth.uid() 
        AND aa.active = true
    );

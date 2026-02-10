
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add user_id column to mfa_accounts
ALTER TABLE public.mfa_accounts 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill user_id from created_by for existing data
UPDATE public.mfa_accounts SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL;

-- 3. Make user_id NOT NULL after backfill
ALTER TABLE public.mfa_accounts ALTER COLUMN user_id SET NOT NULL;

-- 4. Add user_id to mfa_recovery_codes if missing
ALTER TABLE public.mfa_recovery_codes 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill recovery codes user_id
UPDATE public.mfa_recovery_codes rc 
SET user_id = ma.user_id 
FROM public.mfa_accounts ma 
WHERE rc.account_id = ma.id AND rc.user_id IS NULL;

-- 5. Rename 'secret' to 'secret_encrypted' to store encrypted values
ALTER TABLE public.mfa_accounts RENAME COLUMN secret TO secret_encrypted;

-- 6. Drop old RLS policies
DROP POLICY IF EXISTS "Admins can view all MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can insert MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can update MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can delete MFA accounts" ON public.mfa_accounts;

DROP POLICY IF EXISTS "Admins can view MFA recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can insert MFA recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can update MFA recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can delete MFA recovery codes" ON public.mfa_recovery_codes;

-- 7. Create new per-user RLS policies for mfa_accounts
CREATE POLICY "Users can view own MFA accounts"
  ON public.mfa_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MFA accounts"
  ON public.mfa_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA accounts"
  ON public.mfa_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own MFA accounts"
  ON public.mfa_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Create new per-user RLS policies for mfa_recovery_codes
CREATE POLICY "Users can view own recovery codes"
  ON public.mfa_recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery codes"
  ON public.mfa_recovery_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery codes"
  ON public.mfa_recovery_codes FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Add index for faster per-user lookups
CREATE INDEX IF NOT EXISTS idx_mfa_accounts_user_id ON public.mfa_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes(user_id);

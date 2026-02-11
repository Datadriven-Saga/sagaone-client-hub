
-- =============================================
-- MFA Governance: Master Access Control System
-- =============================================

-- 1. Master Users table (who has Master access)
CREATE TABLE public.mfa_master_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

ALTER TABLE public.mfa_master_users ENABLE ROW LEVEL SECURITY;

-- Only master users can see this table
CREATE POLICY "Only master can view master_users"
  ON public.mfa_master_users FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

-- 2. MFA Account Access assignments (who can see which authenticator)
CREATE TABLE public.mfa_account_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(account_id, user_id)
);

ALTER TABLE public.mfa_account_access ENABLE ROW LEVEL SECURITY;

-- Master can see all access records; users can see their own
CREATE POLICY "Master sees all access, users see own"
  ON public.mfa_account_access FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM public.mfa_master_users)
    OR auth.uid() = user_id
  );

-- Only master can insert/update/delete access
CREATE POLICY "Only master can manage access"
  ON public.mfa_account_access FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

CREATE POLICY "Only master can update access"
  ON public.mfa_account_access FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

CREATE POLICY "Only master can delete access"
  ON public.mfa_account_access FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

-- 3. MFA Audit Logs (complete traceability)
CREATE TABLE public.mfa_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL, -- 'create', 'view', 'copy', 'delete', 'grant_access', 'revoke_access', 'rename', 'recovery_view', 'recovery_copy'
  account_id TEXT,
  account_issuer TEXT,
  target_user_id UUID,
  target_user_email TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only master can view audit logs
CREATE POLICY "Only master can view audit logs"
  ON public.mfa_audit_logs FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

-- Authenticated users can insert logs (for their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.mfa_audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_mfa_audit_logs_created_at ON public.mfa_audit_logs(created_at DESC);
CREATE INDEX idx_mfa_audit_logs_action ON public.mfa_audit_logs(action);
CREATE INDEX idx_mfa_audit_logs_account_id ON public.mfa_audit_logs(account_id);

-- 4. MFA Feature Flags
CREATE TABLE public.mfa_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.mfa_feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read flags (to check if features are enabled)
CREATE POLICY "Authenticated users can read flags"
  ON public.mfa_feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only master can manage flags
CREATE POLICY "Only master can manage flags"
  ON public.mfa_feature_flags FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.mfa_master_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.mfa_master_users));

-- Insert default feature flags
INSERT INTO public.mfa_feature_flags (flag_key, flag_label, enabled) VALUES
  ('mfa_create_authenticator', 'Criação de Authenticator', true),
  ('mfa_view_codes', 'Visualização de códigos', true),
  ('mfa_assign_access', 'Atribuição de acesso', true),
  ('mfa_view_logs', 'Visualização de logs', true);

-- 5. Security definer function to check if user is MFA Master
CREATE OR REPLACE FUNCTION public.is_mfa_master(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mfa_master_users WHERE user_id = check_user_id
  );
$$;

-- 6. Update RLS on mfa_accounts: Master sees all, others see only assigned
-- First drop existing policies
DROP POLICY IF EXISTS "Users can view own MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Users can insert own MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Users can update own MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Users can delete own MFA accounts" ON public.mfa_accounts;

-- New policies: Master sees all; regular users see only accounts assigned to them OR created by them
CREATE POLICY "MFA accounts visibility"
  ON public.mfa_accounts FOR SELECT
  USING (
    public.is_mfa_master(auth.uid())
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.mfa_account_access aa
        WHERE aa.account_id = mfa_accounts.id
        AND aa.user_id = auth.uid()
        AND aa.active = true
      )
    )
  );

-- Only master can create accounts
CREATE POLICY "Only master can create MFA accounts"
  ON public.mfa_accounts FOR INSERT
  WITH CHECK (
    public.is_mfa_master(auth.uid())
  );

-- Only master can update accounts
CREATE POLICY "Only master can update MFA accounts"
  ON public.mfa_accounts FOR UPDATE
  USING (
    public.is_mfa_master(auth.uid())
  );

-- Only master can delete accounts
CREATE POLICY "Only master can delete MFA accounts"
  ON public.mfa_accounts FOR DELETE
  USING (
    public.is_mfa_master(auth.uid())
  );

-- 7. Update RLS on mfa_recovery_codes similarly
DROP POLICY IF EXISTS "Users can view own recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Users can manage own recovery codes" ON public.mfa_recovery_codes;

CREATE POLICY "MFA recovery codes visibility"
  ON public.mfa_recovery_codes FOR SELECT
  USING (
    public.is_mfa_master(auth.uid())
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.mfa_account_access aa
        WHERE aa.account_id = mfa_recovery_codes.account_id
        AND aa.user_id = auth.uid()
        AND aa.active = true
      )
    )
  );

CREATE POLICY "Only master can manage recovery codes"
  ON public.mfa_recovery_codes FOR INSERT
  WITH CHECK (public.is_mfa_master(auth.uid()));

CREATE POLICY "Only master can update recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE
  USING (public.is_mfa_master(auth.uid()));

CREATE POLICY "Only master can delete recovery codes"
  ON public.mfa_recovery_codes FOR DELETE
  USING (public.is_mfa_master(auth.uid()));

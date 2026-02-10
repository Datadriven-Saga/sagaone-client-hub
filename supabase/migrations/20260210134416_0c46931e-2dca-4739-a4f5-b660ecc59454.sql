
-- Create table for MFA accounts (shared across all admins)
CREATE TABLE public.mfa_accounts (
  id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  label TEXT,
  secret TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA1',
  digits INTEGER NOT NULL DEFAULT 6,
  period INTEGER NOT NULL DEFAULT 30,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.mfa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_accounts FORCE ROW LEVEL SECURITY;

-- All authenticated admins/TI can view all MFA accounts
CREATE POLICY "Admins can view all MFA accounts"
  ON public.mfa_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

-- Admins/TI can insert MFA accounts
CREATE POLICY "Admins can insert MFA accounts"
  ON public.mfa_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

-- Admins/TI can delete MFA accounts
CREATE POLICY "Admins can delete MFA accounts"
  ON public.mfa_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

-- Update recovery codes policies to also allow cross-user access for admins
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Users can insert own recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Users can update own recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Users can delete own recovery codes" ON public.mfa_recovery_codes;

-- New policies: admins see all recovery codes
CREATE POLICY "Admins can view all recovery codes"
  ON public.mfa_recovery_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

CREATE POLICY "Admins can insert recovery codes"
  ON public.mfa_recovery_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

CREATE POLICY "Admins can update recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

CREATE POLICY "Admins can delete recovery codes"
  ON public.mfa_recovery_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

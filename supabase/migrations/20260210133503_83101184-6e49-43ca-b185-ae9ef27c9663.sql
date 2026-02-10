
CREATE TABLE public.mfa_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  codes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recovery codes"
ON public.mfa_recovery_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recovery codes"
ON public.mfa_recovery_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recovery codes"
ON public.mfa_recovery_codes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recovery codes"
ON public.mfa_recovery_codes FOR DELETE
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_mfa_recovery_codes_account ON public.mfa_recovery_codes(user_id, account_id);


-- Fix: set view to security_invoker to respect RLS of the querying user
ALTER VIEW public.mfa_password_vault_decrypted SET (security_invoker = true);

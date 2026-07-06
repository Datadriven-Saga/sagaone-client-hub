-- Allow OTP as a login method in the existing domain allowlist
ALTER TABLE public.allowed_login_domains
  DROP CONSTRAINT IF EXISTS allowed_login_domains_tipo_check;

ALTER TABLE public.allowed_login_domains
  ADD CONSTRAINT allowed_login_domains_tipo_check
  CHECK (tipo = ANY (ARRAY['sso'::text, 'password'::text, 'otp'::text, 'both'::text, 'ambos'::text]));

-- Keep the corporate domain active for SSO and OTP through the combined mode.
UPDATE public.allowed_login_domains
   SET tipo = 'both', updated_at = now()
 WHERE dominio = 'gruposaga.com.br'::citext
   AND ativo = true
   AND tipo = 'sso';

-- Audit/rate-limit table for OTP requests. It is service-only: no browser role can read it.
CREATE TABLE public.otp_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip inet,
  outcome text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_login_attempts TO service_role;

ALTER TABLE public.otp_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage otp login attempts"
ON public.otp_login_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX otp_login_attempts_email_created_at_idx
  ON public.otp_login_attempts (lower(email), created_at DESC);

CREATE INDEX otp_login_attempts_ip_created_at_idx
  ON public.otp_login_attempts (ip, created_at DESC)
  WHERE ip IS NOT NULL;

-- Resolve and validate an OTP login candidate by email for the edge function.
CREATE OR REPLACE FUNCTION public.resolve_login_otp_user(_email text)
RETURNS TABLE(user_id uuid, allowed boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT u.id
    INTO v_user_id
    FROM auth.users u
   WHERE lower(u.email) = lower(trim(_email))
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_user_id, public.can_user_login(v_user_id, 'otp');
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_otp_user(text) TO service_role;

-- Extend login gate so external users can be explicitly permitted for OTP.
CREATE OR REPLACE FUNCTION public.can_user_login(_user_id uuid, _method text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email        text;
  v_dominio      text;
  v_is_external  boolean;
  v_is_active    boolean;
  v_empresa_id   uuid;
  v_provider     text;
  v_method       text;
  v_tipo_dominio text;
  v_seat_ok      boolean;
  v_flag_ok      boolean;
BEGIN
  SELECT u.email,
         COALESCE(p.is_external, false),
         COALESCE(p.is_active, true),
         p.empresa_id,
         u.raw_app_meta_data->>'provider'
    INTO v_email, v_is_external, v_is_active, v_empresa_id, v_provider
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.id = _user_id;

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  IF NOT v_is_active THEN
    RETURN false;
  END IF;

  v_dominio := lower(split_part(v_email, '@', 2));

  SELECT tipo INTO v_tipo_dominio
    FROM public.allowed_login_domains
   WHERE ativo = true AND dominio = v_dominio::citext
   LIMIT 1;

  IF v_tipo_dominio IS NULL THEN
    RETURN false;
  END IF;

  -- Internal users: active allowlisted domain + active profile is enough.
  -- This preserves the current SSO behavior and also allows OTP fallback.
  IF NOT v_is_external THEN
    RETURN true;
  END IF;

  -- External users: keep method gate strict.
  v_method := COALESCE(
    NULLIF(_method, ''),
    CASE
      WHEN v_provider = 'email' THEN 'password'
      WHEN v_provider IS NOT NULL THEN 'sso'
      ELSE 'password'
    END
  );

  IF v_method = 'password' AND v_tipo_dominio NOT IN ('password','both','ambos') THEN
    RETURN false;
  END IF;

  IF v_method = 'sso' AND v_tipo_dominio NOT IN ('sso','both','ambos') THEN
    RETURN false;
  END IF;

  IF v_method = 'otp' AND v_tipo_dominio NOT IN ('otp','both','ambos') THEN
    RETURN false;
  END IF;

  IF v_method NOT IN ('password','sso','otp') THEN
    RETURN false;
  END IF;

  -- External users: company feature flag must be active.
  IF v_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  v_flag_ok := public.is_feature_enabled_for_empresa('login_terceiros_cadeiras', v_empresa_id);
  IF NOT v_flag_ok THEN
    RETURN false;
  END IF;

  -- External users: must still have an active valid seat.
  SELECT EXISTS (
    SELECT 1
      FROM public.external_access_seats s
      JOIN public.prospeccoes pr ON pr.id = s.prospeccao_id
     WHERE s.profile_id = _user_id
       AND s.status = 'active'
       AND COALESCE(pr.ativo, true) = true
       AND COALESCE(pr.snapshot_realizado, false) = false
       AND pr.data_fim >= CURRENT_DATE
  ) INTO v_seat_ok;

  IF NOT v_seat_ok THEN
    UPDATE public.external_access_seats s
       SET status = 'expired', updated_at = now()
     WHERE s.profile_id = _user_id
       AND s.status = 'active';
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO service_role;
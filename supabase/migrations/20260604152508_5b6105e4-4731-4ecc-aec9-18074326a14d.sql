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

  -- Domínio deve estar na allowlist e ativo
  SELECT tipo INTO v_tipo_dominio
    FROM public.allowed_login_domains
   WHERE ativo = true AND dominio = v_dominio::citext
   LIMIT 1;

  IF v_tipo_dominio IS NULL THEN
    RETURN false;
  END IF;

  -- Internos: domínio ativo + is_active já basta. Ignora método (evita bloqueio
  -- de internos com raw_app_meta_data.provider='email' legado que migraram p/ SSO).
  IF NOT v_is_external THEN
    RETURN true;
  END IF;

  -- Externos: gate de método SSO × senha permanece estrito
  v_method := COALESCE(
    NULLIF(_method, ''),
    CASE
      WHEN v_provider = 'email' THEN 'password'
      WHEN v_provider IS NOT NULL THEN 'sso'
      ELSE 'password'
    END
  );

  IF v_method = 'password' AND v_tipo_dominio NOT IN ('password','both') THEN
    RETURN false;
  END IF;

  IF v_method = 'sso' AND v_tipo_dominio NOT IN ('sso','both') THEN
    RETURN false;
  END IF;

  -- Externos: feature flag por empresa precisa estar ativa
  IF v_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  v_flag_ok := public.is_feature_enabled_for_empresa('login_terceiros_cadeiras', v_empresa_id);
  IF NOT v_flag_ok THEN
    RETURN false;
  END IF;

  -- Externos: precisa de seat ativo + evento dentro do prazo
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
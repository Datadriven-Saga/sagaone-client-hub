-- ============================================================================
-- Fase 1 — Login de Terceiros + Cadeiras
-- Banco: domínios de login, profiles.is_external/is_active, cadeiras,
-- RPCs can_user_login + password_login_enabled, guard no SSO, feature flag.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 Extensão citext (para dominio case-insensitive)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- 1.2 Tabela allowed_login_domains
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_login_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio     citext NOT NULL UNIQUE,
  tipo        text   NOT NULL CHECK (tipo IN ('sso','password','both')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.allowed_login_domains TO authenticated;
GRANT ALL ON public.allowed_login_domains TO service_role;

ALTER TABLE public.allowed_login_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_login_domains read all authenticated"
  ON public.allowed_login_domains FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "allowed_login_domains admin write"
  ON public.allowed_login_domains FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_allowed_login_domains_updated_at
  BEFORE UPDATE ON public.allowed_login_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial
INSERT INTO public.allowed_login_domains (dominio, tipo, ativo)
VALUES
  ('gruposaga.com.br', 'sso', true),
  ('one.sagadatadriven.com.br', 'password', true)
ON CONFLICT (dominio) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1.3 Colunas em profiles (is_external, is_active, external_created_by)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_external          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS external_created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_external_created_by
  ON public.profiles(external_created_by) WHERE external_created_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1.4 Tabela external_access_seats
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_access_seats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  prospeccao_id   uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE RESTRICT,
  created_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Apenas 1 seat ativo por profile
CREATE UNIQUE INDEX IF NOT EXISTS uniq_external_access_seats_one_active
  ON public.external_access_seats(profile_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_external_access_seats_empresa_status
  ON public.external_access_seats(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_external_access_seats_created_by
  ON public.external_access_seats(created_by);
CREATE INDEX IF NOT EXISTS idx_external_access_seats_prospeccao
  ON public.external_access_seats(prospeccao_id);

GRANT SELECT, INSERT, UPDATE ON public.external_access_seats TO authenticated;
GRANT ALL ON public.external_access_seats TO service_role;

ALTER TABLE public.external_access_seats ENABLE ROW LEVEL SECURITY;

-- SELECT: admin OU criador. Terceiro NÃO vê a própria cadeira.
CREATE POLICY "external_access_seats select"
  ON public.external_access_seats FOR SELECT
  TO authenticated
  USING (public.is_admin() OR created_by = auth.uid());

-- INSERT/UPDATE só admin via UI direta; criação real via edge (service role).
CREATE POLICY "external_access_seats admin write"
  ON public.external_access_seats FOR ALL
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_external_access_seats_updated_at
  BEFORE UPDATE ON public.external_access_seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 1.5 Tabela external_seat_limits (configuração de cadeiras por loja)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_seat_limits (
  empresa_id  uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  max_seats   integer NOT NULL DEFAULT 5 CHECK (max_seats >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT ON public.external_seat_limits TO authenticated;
GRANT ALL ON public.external_seat_limits TO service_role;

ALTER TABLE public.external_seat_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_seat_limits read all"
  ON public.external_seat_limits FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "external_seat_limits admin write"
  ON public.external_seat_limits FOR ALL
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_external_seat_limits_updated_at
  BEFORE UPDATE ON public.external_seat_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: retorna o limite de cadeiras para uma empresa (default 5)
CREATE OR REPLACE FUNCTION public.get_seats_limit(p_empresa_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT max_seats FROM public.external_seat_limits WHERE empresa_id = p_empresa_id),
    5
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_seats_limit(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1.6 RPC password_login_enabled() — boolean puro, sem expor lista
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.password_login_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_login_domains
    WHERE ativo = true AND tipo IN ('password','both')
  );
$$;

GRANT EXECUTE ON FUNCTION public.password_login_enabled() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1.7 RPC can_user_login(_user_id, _method)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_login(
  _user_id uuid,
  _method  text DEFAULT NULL  -- 'sso' | 'password' | NULL (infere)
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Método: parâmetro tem prioridade; senão infere do provider Supabase
  v_method := COALESCE(
    NULLIF(_method, ''),
    CASE
      WHEN v_provider = 'email' THEN 'password'
      WHEN v_provider IS NOT NULL THEN 'sso'
      ELSE 'sso'  -- default conservador para usuários internos
    END
  );

  -- Domínio deve estar na allowlist ativo e permitir o método
  SELECT tipo INTO v_tipo_dominio
    FROM public.allowed_login_domains
   WHERE ativo = true AND dominio = v_dominio::citext
   LIMIT 1;

  IF v_tipo_dominio IS NULL THEN
    RETURN false;
  END IF;

  IF v_method = 'password' AND v_tipo_dominio NOT IN ('password','both') THEN
    RETURN false;
  END IF;

  IF v_method = 'sso' AND v_tipo_dominio NOT IN ('sso','both') THEN
    RETURN false;
  END IF;

  -- Internos passam aqui
  IF NOT v_is_external THEN
    RETURN true;
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
  -- Critério "evento ativo": data_fim >= today AND NOT snapshot_realizado AND ativo
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
    -- Lazy expiration: marca todos os seats ativos vencidos como expired
    UPDATE public.external_access_seats s
       SET status = 'expired', updated_at = now()
     WHERE s.profile_id = _user_id
       AND s.status = 'active';
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1.8 Guard em auto_provision_user_from_sso
-- Pula externos (lidos via raw_app_meta_data, definido por edge ao criar)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_provision_user_from_sso(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meta jsonb;
  v_app_meta jsonb;
  v_claims jsonb;
  v_department text;
  v_company text;
  v_job_title text;
  v_empresa_id uuid;
  v_tipo tipo_acesso;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  SELECT raw_user_meta_data, raw_app_meta_data
    INTO v_meta, v_app_meta
    FROM auth.users WHERE id = p_user_id;

  -- Guard: terceiros nunca passam pelo provisionamento de SSO
  IF COALESCE(v_app_meta->>'is_external','false') = 'true' THEN
    RETURN jsonb_build_object('status','skipped_external');
  END IF;

  IF v_meta IS NULL THEN
    RETURN jsonb_build_object('status','no_metadata');
  END IF;

  v_claims := COALESCE(v_meta->'custom_claims', '{}'::jsonb);

  v_department := COALESCE(
    NULLIF(v_meta->>'department',''),
    NULLIF(v_claims->>'department','')
  );
  v_company := COALESCE(
    NULLIF(v_meta->>'companyName',''),
    NULLIF(v_meta->>'company',''),
    NULLIF(v_claims->>'companyName',''),
    NULLIF(v_claims->>'company','')
  );
  v_job_title := COALESCE(
    NULLIF(v_meta->>'jobTitle',''),
    NULLIF(v_meta->>'title',''),
    NULLIF(v_claims->>'jobTitle',''),
    NULLIF(v_claims->>'title','')
  );

  v_changes := jsonb_build_object(
    'department_claim', v_department,
    'company_claim', v_company,
    'job_title_claim', v_job_title
  );

  IF v_company IS NOT NULL THEN
    SELECT id INTO v_empresa_id
      FROM empresas
     WHERE nome_empresa ILIKE '%' || v_company || '%'
       AND cnpj NOT IN ('00000000000000','00.000.000/0001-00')
     LIMIT 1;
    v_changes := v_changes || jsonb_build_object('empresa_matched', v_empresa_id IS NOT NULL, 'empresa_id', v_empresa_id::text);
  END IF;

  IF v_job_title IS NOT NULL THEN
    SELECT m.tipo_acesso INTO v_tipo
      FROM cargo_tipo_acesso_mapping m
     WHERE LOWER(m.cargo_azure) = LOWER(v_job_title)
     LIMIT 1;
    v_changes := v_changes || jsonb_build_object('tipo_acesso_matched', v_tipo::text);
  END IF;

  UPDATE profiles SET
    departamento = COALESCE(v_department, departamento),
    empresa_id   = COALESCE(v_empresa_id, empresa_id),
    tipo_acesso  = COALESCE(v_tipo, tipo_acesso),
    updated_at   = now()
   WHERE id = p_user_id;

  IF v_empresa_id IS NOT NULL THEN
    UPDATE user_empresas SET is_ativa = false WHERE user_id = p_user_id;

    INSERT INTO user_empresas (user_id, empresa_id, is_ativa)
    VALUES (p_user_id, v_empresa_id, true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET is_ativa = true, updated_at = now();
  END IF;

  RETURN jsonb_build_object('status','ok','details', v_changes);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 1.9 Feature flag login_terceiros_cadeiras (default off)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_feature_flags (flag_key, flag_label, description, category, is_enabled, scope)
VALUES (
  'login_terceiros_cadeiras',
  'Login de Terceiros + Cadeiras',
  'Habilita login externo de terceiros e gestão de cadeiras por loja',
  'auth',
  true,            -- flag globalmente registrada
  'per_empresa'    -- ativação efetiva é por empresa via feature_flag_empresas
)
ON CONFLICT (flag_key) DO NOTHING;
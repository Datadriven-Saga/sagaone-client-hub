-- 1. Tabela de mapeamento cargo Azure → tipo_acesso
CREATE TABLE public.cargo_tipo_acesso_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_azure text NOT NULL,
  tipo_acesso tipo_acesso NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cargo_azure)
);

ALTER TABLE public.cargo_tipo_acesso_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cargo mapping"
  ON public.cargo_tipo_acesso_mapping
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read cargo mapping"
  ON public.cargo_tipo_acesso_mapping
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Função de auto-provisionamento a partir dos claims do Azure SSO
CREATE OR REPLACE FUNCTION public.auto_provision_user_from_sso(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meta jsonb;
  v_claims jsonb;
  v_department text;
  v_company text;
  v_job_title text;
  v_empresa_id uuid;
  v_tipo tipo_acesso;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = p_user_id;
  
  IF v_meta IS NULL THEN 
    RETURN jsonb_build_object('status', 'no_metadata');
  END IF;
  
  v_claims := COALESCE(v_meta->'custom_claims', '{}'::jsonb);
  
  v_department := COALESCE(
    NULLIF(v_meta->>'department', ''),
    NULLIF(v_claims->>'department', '')
  );
  v_company := COALESCE(
    NULLIF(v_meta->>'companyName', ''),
    NULLIF(v_meta->>'company', ''),
    NULLIF(v_claims->>'companyName', ''),
    NULLIF(v_claims->>'company', '')
  );
  v_job_title := COALESCE(
    NULLIF(v_meta->>'jobTitle', ''),
    NULLIF(v_meta->>'title', ''),
    NULLIF(v_claims->>'jobTitle', ''),
    NULLIF(v_claims->>'title', '')
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
      AND cnpj NOT IN ('00000000000000', '00.000.000/0001-00')
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
    empresa_id = COALESCE(v_empresa_id, empresa_id),
    tipo_acesso = COALESCE(v_tipo, tipo_acesso),
    updated_at = now()
  WHERE id = p_user_id;
  
  IF v_empresa_id IS NOT NULL THEN
    UPDATE user_empresas SET is_ativa = false WHERE user_id = p_user_id;
    
    INSERT INTO user_empresas (user_id, empresa_id, is_ativa)
    VALUES (p_user_id, v_empresa_id, true)
    ON CONFLICT (user_id, empresa_id) DO UPDATE SET is_ativa = true, updated_at = now();
  END IF;
  
  RETURN jsonb_build_object('status', 'ok', 'details', v_changes);
END;
$$;

-- 3. Atualizar handle_new_user para chamar auto-provisioning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  PERFORM public.auto_provision_user_from_sso(NEW.id);
  
  RETURN NEW;
END;
$$;
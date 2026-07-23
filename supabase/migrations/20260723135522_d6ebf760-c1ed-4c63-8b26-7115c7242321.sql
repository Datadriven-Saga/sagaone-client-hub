
-- 1) Arquivo de snapshot dos usuários excluídos
CREATE TABLE IF NOT EXISTS public.deleted_users_archive (
  id uuid PRIMARY KEY,
  email text,
  nome_completo text,
  tipo_acesso text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.deleted_users_archive TO authenticated;
GRANT ALL ON public.deleted_users_archive TO service_role;

ALTER TABLE public.deleted_users_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/Master can read deleted users archive" ON public.deleted_users_archive;
CREATE POLICY "Admins/Master can read deleted users archive"
  ON public.deleted_users_archive
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND tipo_acesso IN ('Administrador','TI','Master')
    )
  );

-- 2) Remover FKs de auditoria que apontam para auth.users
DO $$
DECLARE
  fk_defs TEXT[][] := ARRAY[
    ['agente_empresas','agente_empresas_created_by_fkey','created_by'],
    ['agentes_nextip','agentes_nextip_created_by_fkey','created_by'],
    ['bases_importadas','bases_importadas_created_by_fkey','created_by'],
    ['controle_agentes','controle_agentes_created_by_fkey','created_by'],
    ['feature_flag_empresas','feature_flag_empresas_created_by_fkey','created_by'],
    ['global_opt_outs','global_opt_outs_criado_por_fkey','criado_por'],
    ['mfa_account_access','mfa_account_access_granted_by_fkey','granted_by'],
    ['mfa_accounts','mfa_accounts_created_by_fkey','created_by'],
    ['mfa_audit_logs','mfa_audit_logs_user_id_fkey','user_id'],
    ['mfa_feature_flags','mfa_feature_flags_updated_by_fkey','updated_by'],
    ['mfa_master_users','mfa_master_users_created_by_fkey','created_by'],
    ['opt_outs','opt_outs_updated_by_fkey','updated_by'],
    ['opt_outs','opt_outs_created_by_fkey','created_by'],
    ['system_feature_flags','system_feature_flags_updated_by_fkey','updated_by']
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(fk_defs,1) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', fk_defs[i][1], fk_defs[i][2]);
    -- Garante que a coluna permanece (sem FK, apenas UUID) e é nullable
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', fk_defs[i][1], fk_defs[i][3]);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 3) Função helper para resolver identidade (usuário ativo OU arquivado)
CREATE OR REPLACE FUNCTION public.resolve_user_identity(_user_id uuid)
RETURNS TABLE (id uuid, nome_completo text, email text, deleted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome_completo, u.email::text, false
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = _user_id
  UNION ALL
  SELECT d.id, d.nome_completo, d.email, true
    FROM public.deleted_users_archive d
    WHERE d.id = _user_id
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_user_identity(uuid) TO authenticated, service_role;

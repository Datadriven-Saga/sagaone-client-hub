DROP POLICY IF EXISTS departamento_permissoes_admin_master_ti ON public.departamento_permissoes;

CREATE POLICY departamento_permissoes_select_authenticated
  ON public.departamento_permissoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY departamento_permissoes_write_admin_master_ti
  ON public.departamento_permissoes
  FOR ALL TO authenticated
  USING (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso,'Master'::tipo_acesso,'TI'::tipo_acesso]))
  WITH CHECK (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso,'Master'::tipo_acesso,'TI'::tipo_acesso]));

GRANT SELECT ON public.departamento_permissoes TO authenticated;
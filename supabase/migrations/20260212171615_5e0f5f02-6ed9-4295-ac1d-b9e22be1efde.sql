
DROP POLICY IF EXISTS "departamento_permissoes_admin_only" ON public.departamento_permissoes;

CREATE POLICY "departamento_permissoes_admin_master_ti"
ON public.departamento_permissoes
FOR ALL
USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso))
WITH CHECK (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso));

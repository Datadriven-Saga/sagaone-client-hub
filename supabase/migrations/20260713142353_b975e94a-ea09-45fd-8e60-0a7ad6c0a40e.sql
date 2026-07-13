DROP POLICY IF EXISTS webhook_registry_master_select ON public.webhook_registry;
DROP POLICY IF EXISTS webhook_registry_master_insert ON public.webhook_registry;
DROP POLICY IF EXISTS webhook_registry_master_update ON public.webhook_registry;

CREATE POLICY webhook_registry_admins_select ON public.webhook_registry
  FOR SELECT TO authenticated
  USING (get_current_user_access_type() IN ('Master'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY webhook_registry_admins_insert ON public.webhook_registry
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_access_type() IN ('Master'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY webhook_registry_admins_update ON public.webhook_registry
  FOR UPDATE TO authenticated
  USING (get_current_user_access_type() IN ('Master'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso))
  WITH CHECK (get_current_user_access_type() IN ('Master'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso));
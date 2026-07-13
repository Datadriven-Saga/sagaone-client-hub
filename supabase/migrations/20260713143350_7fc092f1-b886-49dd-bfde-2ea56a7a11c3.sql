CREATE POLICY "webhook_registry_admins_delete" ON public.webhook_registry
FOR DELETE TO authenticated
USING (get_current_user_access_type() = ANY (ARRAY['Master'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso]));
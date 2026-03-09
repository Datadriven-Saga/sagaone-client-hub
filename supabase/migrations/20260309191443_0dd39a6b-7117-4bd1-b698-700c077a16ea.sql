
DROP POLICY "Admins and managers can create jobs" ON campaign_jobs;
CREATE POLICY "Admins and managers can create jobs" ON campaign_jobs
FOR INSERT WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY (ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Master'::tipo_acesso,
    'CRM'::tipo_acesso
  ])
);

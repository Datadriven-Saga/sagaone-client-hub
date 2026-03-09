-- Fix 1: campaign_jobs INSERT policy - add all roles that can dispatch
DROP POLICY "Admins and managers can create jobs" ON campaign_jobs;
CREATE POLICY "Authorized roles can create jobs" ON campaign_jobs
FOR INSERT WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY (ARRAY[
    'Administrador'::tipo_acesso,
    'TI'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Master'::tipo_acesso,
    'CRM'::tipo_acesso,
    'Coordenadora de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Fix 2: campaign_batches - replace ALL policy with explicit INSERT + SELECT + UPDATE
DROP POLICY "System can manage batches" ON campaign_batches;

CREATE POLICY "Users can insert batches for their company jobs" ON campaign_batches
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaign_jobs cj
    WHERE cj.id = campaign_batches.job_id
    AND cj.empresa_id = get_user_active_company(auth.uid())
  )
);

CREATE POLICY "Users can update batches for their company jobs" ON campaign_batches
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM campaign_jobs cj
    WHERE cj.id = campaign_batches.job_id
    AND cj.empresa_id = get_user_active_company(auth.uid())
  )
);

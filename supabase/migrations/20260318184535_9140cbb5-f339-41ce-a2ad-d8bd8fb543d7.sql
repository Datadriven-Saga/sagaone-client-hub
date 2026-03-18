-- 1. Fix mfa_accounts_decrypted view: add security_invoker
CREATE OR REPLACE VIEW public.mfa_accounts_decrypted
WITH (security_invoker = true)
AS
SELECT 
    ma.id,
    ma.issuer,
    ma.label,
    public.decrypt_mfa_secret(ma.secret_encrypted) AS secret,
    ma.algorithm,
    ma.digits,
    ma.period,
    ma.user_id,
    ma.created_by,
    ma.created_at,
    ma.updated_at
FROM public.mfa_accounts ma
WHERE public.is_mfa_master(auth.uid()) 
   OR ma.user_id = auth.uid() 
   OR EXISTS (
       SELECT 1 FROM public.mfa_account_access aa
       WHERE aa.account_id = ma.id AND aa.user_id = auth.uid() AND aa.active = true
   );

-- 2. Fix profiles_safe view: add security_invoker and restrict to authenticated
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    p.nome_completo,
    p.tipo_acesso,
    p.departamento,
    p.status,
    p.empresa_id,
    p.foto_url,
    p.created_at,
    p.updated_at
FROM public.profiles p
WHERE auth.uid() IS NOT NULL;

-- 3. Fix template_pausado_log: drop public policy and create service_role only
DROP POLICY IF EXISTS "Service role full access on template_pausado_log" ON public.template_pausado_log;

CREATE POLICY "Service role full access on template_pausado_log"
ON public.template_pausado_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can read template_pausado_log"
ON public.template_pausado_log
FOR SELECT
TO authenticated
USING (
    public.get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
);
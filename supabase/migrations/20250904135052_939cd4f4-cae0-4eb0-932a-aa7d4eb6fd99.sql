-- Corrigir problemas multi-empresa - abordagem direta

-- 1. Primeiro, vamos garantir que o usuário atual tenha associação ativa
UPDATE public.user_empresas 
SET is_ativa = TRUE, updated_at = now()
WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
AND empresa_id = (
  SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1
);

-- 2. Se não existe associação, criar
INSERT INTO public.user_empresas (user_id, empresa_id, is_ativa)
SELECT 
  'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00',
  (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1),
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = TRUE
);

-- 3. Corrigir RLS policy para empresas - permitir que administradores vejam todas
DROP POLICY IF EXISTS "empresas_admins_only_manage" ON public.empresas;
DROP POLICY IF EXISTS "empresas_users_own_company_readonly" ON public.empresas;
DROP POLICY IF EXISTS "rls_empresas_admin_manage" ON public.empresas;
DROP POLICY IF EXISTS "rls_empresas_default_deny" ON public.empresas;
DROP POLICY IF EXISTS "rls_empresas_user_readonly" ON public.empresas;

-- Nova policy mais simples para empresas
CREATE POLICY "empresas_admin_full_access" ON public.empresas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND tipo_acesso = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    )
  );

CREATE POLICY "empresas_users_readonly" ON public.empresas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_empresas ue
      JOIN public.profiles p ON ue.user_id = p.id
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = empresas.id
    )
  );
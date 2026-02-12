
-- Fix contatos RLS policy to include Master and CRM access types
DROP POLICY IF EXISTS "contatos_managers_full_access" ON public.contatos;

CREATE POLICY "contatos_managers_full_access" ON public.contatos
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY (
    ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Diretor'::tipo_acesso, 
          'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso,
          'Master'::tipo_acesso, 'CRM'::tipo_acesso]
  )
);

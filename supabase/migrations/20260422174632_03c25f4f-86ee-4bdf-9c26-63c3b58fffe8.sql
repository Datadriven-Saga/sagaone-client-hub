-- Restrict deletion of recepcao_visitas to Gerente de Leads and above
-- Drop the unified ALL policy and recreate split policies

DROP POLICY IF EXISTS recepcao_visitas_authenticated_empresa_access ON public.recepcao_visitas;

-- SELECT/INSERT/UPDATE: any authenticated user from the active company
CREATE POLICY recepcao_visitas_select
  ON public.recepcao_visitas
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND empresa_id = public.get_user_active_company(auth.uid()));

CREATE POLICY recepcao_visitas_insert
  ON public.recepcao_visitas
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND empresa_id = public.get_user_active_company(auth.uid()));

CREATE POLICY recepcao_visitas_update
  ON public.recepcao_visitas
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND empresa_id = public.get_user_active_company(auth.uid()))
  WITH CHECK (auth.uid() IS NOT NULL AND empresa_id = public.get_user_active_company(auth.uid()));

-- DELETE: only Gerente de Leads and above
CREATE POLICY recepcao_visitas_delete_gerente_acima
  ON public.recepcao_visitas
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND empresa_id = public.get_user_active_company(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tipo_acesso IN (
          'Gerente de Leads',
          'Gerente de Loja',
          'Coordenadora de Leads',
          'Diretor',
          'Proprietário',
          'TI',
          'Administrador',
          'Master'
        )
    )
  );
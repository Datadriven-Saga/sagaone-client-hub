
-- Fix RLS policies for PRI tables to allow access to ALL user companies, not just the active one
-- This matches the pattern used by agente_empresas

-- eventos_pri_voz
DROP POLICY IF EXISTS "eventos_pri_voz_empresa_users_all" ON public.eventos_pri_voz;
CREATE POLICY "eventos_pri_voz_empresa_users_all"
  ON public.eventos_pri_voz FOR ALL
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      UNION
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI')
    )
  );

-- prospect_pri_voz
DROP POLICY IF EXISTS "prospect_pri_voz_empresa_users_all" ON public.prospect_pri_voz;
CREATE POLICY "prospect_pri_voz_empresa_users_all"
  ON public.prospect_pri_voz FOR ALL
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      UNION
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI')
    )
  );

-- cadencia_pri_voz
DROP POLICY IF EXISTS "cadencia_pri_voz_empresa_users_all" ON public.cadencia_pri_voz;
CREATE POLICY "cadencia_pri_voz_empresa_users_all"
  ON public.cadencia_pri_voz FOR ALL
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      UNION
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI')
    )
  );

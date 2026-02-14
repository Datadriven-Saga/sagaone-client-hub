
-- Update agente_empresas RLS policies to include Master role

DROP POLICY IF EXISTS "Admins and TI can create agent-company assignments" ON public.agente_empresas;
CREATE POLICY "Admins TI and Master can create agent-company assignments"
ON public.agente_empresas FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
  )
);

DROP POLICY IF EXISTS "Admins and TI can delete agent-company assignments" ON public.agente_empresas;
CREATE POLICY "Admins TI and Master can delete agent-company assignments"
ON public.agente_empresas FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
  )
);

DROP POLICY IF EXISTS "Admins and TI can update agent-company assignments" ON public.agente_empresas;
CREATE POLICY "Admins TI and Master can update agent-company assignments"
ON public.agente_empresas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
  )
);

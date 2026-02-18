-- Corrigir política RLS de agentes_ia para incluir Master e outros perfis administrativos
DROP POLICY IF EXISTS "agentes_ia_admin_ti_full_access" ON public.agentes_ia;

CREATE POLICY "agentes_ia_admin_ti_master_full_access"
ON public.agentes_ia
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso = ANY (ARRAY[
        'Administrador'::tipo_acesso,
        'TI'::tipo_acesso,
        'Master'::tipo_acesso
      ])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso = ANY (ARRAY[
        'Administrador'::tipo_acesso,
        'TI'::tipo_acesso,
        'Master'::tipo_acesso
      ])
  )
);
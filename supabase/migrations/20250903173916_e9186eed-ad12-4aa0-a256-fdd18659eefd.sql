-- Allow users to see companies they have access to
DROP POLICY IF EXISTS "Administradores podem ver todas as empresas" ON public.empresas;

-- New policy: users can see companies they have access to
CREATE POLICY "Users can view companies they have access to" 
ON public.empresas 
FOR SELECT 
USING (
  is_admin() OR 
  id IN (
    SELECT empresa_id 
    FROM user_empresas 
    WHERE user_id = auth.uid()
  )
);
-- Fix: Ensure only ONE active empresa per user (keep the first one found)
WITH ranked_empresas AS (
  SELECT 
    id,
    user_id,
    empresa_id,
    is_ativa,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn
  FROM user_empresas
  WHERE is_ativa = true
)
UPDATE user_empresas ue
SET is_ativa = false, updated_at = now()
FROM ranked_empresas re
WHERE ue.id = re.id AND re.rn > 1;

-- Drop old restrictive INSERT policy
DROP POLICY IF EXISTS "whatsapp_templates_insert_own_company" ON public.whatsapp_templates;

-- Create new INSERT policy that allows insert if user has access to the empresa
CREATE POLICY "whatsapp_templates_insert_own_company"
ON public.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (
  -- User's active company
  empresa_id = get_user_active_company(auth.uid())
  OR 
  -- Any company user has access to
  empresa_id IN (SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid())
  OR
  -- User's profile empresa
  empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid())
  OR
  -- Admin/TI users
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI'))
);

-- Drop old restrictive SELECT policy
DROP POLICY IF EXISTS "whatsapp_templates_select_by_pri_telefone" ON public.whatsapp_templates;

-- Create new SELECT policy that includes empresa-based access
CREATE POLICY "whatsapp_templates_select_policy"
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (
  -- By pri_telefone (original logic)
  (pri_telefone IS NOT NULL AND pri_telefone = get_user_pri_telefone())
  OR
  -- User's active company
  empresa_id = get_user_active_company(auth.uid())
  OR 
  -- Any company user has access to
  empresa_id IN (SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid())
  OR
  -- User's profile empresa
  empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid())
  OR
  -- Admin/TI users
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI'))
);

-- Also fix UPDATE policy to be more flexible
DROP POLICY IF EXISTS "whatsapp_templates_update_by_pri_telefone" ON public.whatsapp_templates;

CREATE POLICY "whatsapp_templates_update_policy"
ON public.whatsapp_templates
FOR UPDATE
TO authenticated
USING (
  (pri_telefone IS NOT NULL AND pri_telefone = get_user_pri_telefone())
  OR empresa_id = get_user_active_company(auth.uid())
  OR empresa_id IN (SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI'))
)
WITH CHECK (
  (pri_telefone IS NOT NULL AND pri_telefone = get_user_pri_telefone())
  OR empresa_id = get_user_active_company(auth.uid())
  OR empresa_id IN (SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI'))
);

-- Fix DELETE policy too
DROP POLICY IF EXISTS "whatsapp_templates_delete_by_pri_telefone" ON public.whatsapp_templates;

CREATE POLICY "whatsapp_templates_delete_policy"
ON public.whatsapp_templates
FOR DELETE
TO authenticated
USING (
  (pri_telefone IS NOT NULL AND pri_telefone = get_user_pri_telefone())
  OR empresa_id = get_user_active_company(auth.uid())
  OR empresa_id IN (SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo_acesso IN ('Administrador', 'TI'))
);
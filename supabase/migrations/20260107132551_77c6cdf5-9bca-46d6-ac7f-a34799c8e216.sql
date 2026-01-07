-- Criar função SECURITY DEFINER que retorna o pri_telefone da empresa ativa do usuário
CREATE OR REPLACE FUNCTION public.get_user_pri_telefone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT REGEXP_REPLACE(COALESCE(ai.telefone, ''), '[^0-9]', '', 'g')
  FROM public.agentes_ia ai
  WHERE ai.empresa_id = get_user_active_company(auth.uid())
    AND ai.nome = 'Pri'
    AND ai.telefone IS NOT NULL
    AND ai.telefone != ''
  LIMIT 1
$$;

-- Dropar policy antiga
DROP POLICY IF EXISTS "whatsapp_templates_empresa_users_all" ON public.whatsapp_templates;

-- Nova policy para SELECT: permite ver templates que compartilham o mesmo pri_telefone
CREATE POLICY "whatsapp_templates_select_by_pri_telefone"
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (
  pri_telefone IS NOT NULL 
  AND pri_telefone = get_user_pri_telefone()
);

-- Policy para INSERT: cria template na empresa ativa (empresa_id obrigatório)
CREATE POLICY "whatsapp_templates_insert_own_company"
ON public.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
);

-- Policy para UPDATE: permite atualizar templates que compartilham o mesmo pri_telefone
CREATE POLICY "whatsapp_templates_update_by_pri_telefone"
ON public.whatsapp_templates
FOR UPDATE
TO authenticated
USING (
  pri_telefone IS NOT NULL 
  AND pri_telefone = get_user_pri_telefone()
)
WITH CHECK (
  pri_telefone IS NOT NULL 
  AND pri_telefone = get_user_pri_telefone()
);

-- Policy para DELETE: permite deletar templates que compartilham o mesmo pri_telefone
CREATE POLICY "whatsapp_templates_delete_by_pri_telefone"
ON public.whatsapp_templates
FOR DELETE
TO authenticated
USING (
  pri_telefone IS NOT NULL 
  AND pri_telefone = get_user_pri_telefone()
);
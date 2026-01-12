-- Corrigir política RLS da tabela agente_empresas para considerar user_empresas
DROP POLICY IF EXISTS "Users can view agent-company assignments for their company" ON public.agente_empresas;

CREATE POLICY "Users can view agent-company assignments for their company" 
ON public.agente_empresas 
FOR SELECT 
USING (
  -- Usuário pode ver se a empresa_id está em suas empresas (user_empresas ou profiles.empresa_id)
  empresa_id IN (
    SELECT ue.empresa_id FROM user_empresas ue WHERE ue.user_id = auth.uid()
    UNION
    SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid() AND p.empresa_id IS NOT NULL
  )
  OR
  -- Ou se é Administrador/TI (pode ver tudo)
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.tipo_acesso IN ('Administrador', 'TI')
  )
);

-- Corrigir política RLS da tabela agentes_ia para permitir ver agentes atribuídos via agente_empresas
DROP POLICY IF EXISTS "agentes_ia_admins_ti_only" ON public.agentes_ia;
DROP POLICY IF EXISTS "agentes_ia_gerentes_read_access" ON public.agentes_ia;

-- Política para Administradores e TI (todas as operações)
CREATE POLICY "agentes_ia_admin_ti_full_access" 
ON public.agentes_ia 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.tipo_acesso IN ('Administrador', 'TI')
  )
);

-- Política para SELECT para todos os usuários autenticados
-- Podem ver agentes que:
-- 1. Pertencem diretamente à empresa ativa (empresa_id)
-- 2. Foram atribuídos à empresa ativa via agente_empresas
CREATE POLICY "agentes_ia_select_by_company_assignment" 
ON public.agentes_ia 
FOR SELECT 
USING (
  -- Agente criado diretamente para a empresa ativa
  empresa_id = get_user_active_company(auth.uid())
  OR
  -- Agente atribuído à empresa ativa via agente_empresas
  EXISTS (
    SELECT 1 FROM agente_empresas ae
    WHERE ae.agente_id = agentes_ia.id
    AND ae.empresa_id = get_user_active_company(auth.uid())
  )
);
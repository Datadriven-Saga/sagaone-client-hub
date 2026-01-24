-- =============================================
-- CORREÇÃO DE SEGURANÇA: RLS para recepcao_visitas e clientes
-- =============================================

-- 1. RECEPCAO_VISITAS - Corrigir acesso público
-- Remover políticas existentes
DROP POLICY IF EXISTS "recepcao_visitas_empresa_users_all" ON recepcao_visitas;
DROP POLICY IF EXISTS "Users can manage visits for their company" ON recepcao_visitas;

-- Garantir que RLS está habilitado
ALTER TABLE recepcao_visitas ENABLE ROW LEVEL SECURITY;

-- Criar política segura que exige autenticação E empresa correta
CREATE POLICY "recepcao_visitas_authenticated_empresa_access"
ON recepcao_visitas
FOR ALL
USING (
  auth.uid() IS NOT NULL 
  AND empresa_id = get_user_active_company(auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND empresa_id = get_user_active_company(auth.uid())
);

-- 2. CLIENTES - Corrigir políticas para exigir autenticação explícita
-- Remover políticas existentes
DROP POLICY IF EXISTS "clientes_managers_full_access" ON clientes;
DROP POLICY IF EXISTS "clientes_users_own_clients" ON clientes;

-- Garantir que RLS está habilitado
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política para gerentes/admins - acesso total aos clientes da empresa
CREATE POLICY "clientes_managers_full_access"
ON clientes
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() IN ('Administrador', 'TI', 'Diretor', 'Gerente de Leads', 'Gerente de Loja')
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() IN ('Administrador', 'TI', 'Diretor', 'Gerente de Leads', 'Gerente de Loja')
);

-- Política para vendedores/SDRs - apenas seus próprios clientes
CREATE POLICY "clientes_users_own_clients"
ON clientes
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
  AND (
    user_id = auth.uid()
    OR id IN (
      SELECT DISTINCT cliente_id 
      FROM contatos 
      WHERE responsavel_email = auth.uid()::text 
        AND cliente_id IS NOT NULL
        AND empresa_id = get_user_active_company(auth.uid())
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id = get_user_active_company(auth.uid())
);
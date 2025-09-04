-- CORREÇÃO: Remover todas as políticas existentes e recriar com nomes únicos

-- 1. CLIENTES - Limpar e recriar políticas
DROP POLICY IF EXISTS "Company admins only - all clients" ON public.clientes;
DROP POLICY IF EXISTS "Users own clients only" ON public.clientes;
DROP POLICY IF EXISTS "Users strict own clients only" ON public.clientes;
DROP POLICY IF EXISTS "Company admins only - modify clients" ON public.clientes;

-- Política 1: Admins/Gerentes veem todos os clientes da empresa
CREATE POLICY "clientes_admin_view_all"
ON public.clientes
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política 2: SDRs veem apenas clientes que criaram
CREATE POLICY "clientes_sdr_own_only"
ON public.clientes  
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- Política 3: Outros usuários veem clientes com contatos atribuídos
CREATE POLICY "clientes_user_assigned"
ON public.clientes
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() NOT IN ('SDR'::tipo_acesso, 'Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Diretor'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso)
  AND id IN (
    SELECT DISTINCT cliente_id
    FROM contatos 
    WHERE responsavel_email = get_current_user_email()
    AND cliente_id IS NOT NULL
    AND empresa_id = get_user_active_company()
  )
);

-- Política 4: Modificações apenas por admins/gerentes
CREATE POLICY "clientes_admin_modify"
ON public.clientes
FOR ALL
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 2. CONTATOS - Limpar e recriar políticas
DROP POLICY IF EXISTS "Company admins only - all contacts" ON public.contatos;
DROP POLICY IF EXISTS "Users assigned contacts only" ON public.contatos;
DROP POLICY IF EXISTS "Users strict assigned contacts only" ON public.contatos;
DROP POLICY IF EXISTS "Company admins only - modify contacts" ON public.contatos;

-- Política 1: Admins veem todos os contatos
CREATE POLICY "contatos_admin_view_all"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso
  ])
);

-- Política 2: Gerentes veem contatos de subordinados
CREATE POLICY "contatos_manager_subordinates"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
  AND responsavel_email IN (
    SELECT COALESCE(
      (SELECT email FROM auth.users WHERE id = p.id),
      ''
    )
    FROM profiles p 
    WHERE p.gestor_imediato = auth.uid()
  )
);

-- Política 3: Usuários veem apenas contatos atribuídos a eles
CREATE POLICY "contatos_user_assigned_only"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND responsavel_email = get_current_user_email()
);

-- Política 4: Modificações apenas por admins/gerentes
CREATE POLICY "contatos_admin_modify"
ON public.contatos
FOR ALL
USING (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  user_in_same_company(empresa_id)
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])  
);
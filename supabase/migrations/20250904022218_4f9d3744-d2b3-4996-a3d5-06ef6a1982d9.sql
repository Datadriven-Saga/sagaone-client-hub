-- CRIAÇÃO FINAL DE POLÍTICAS DE SEGURANÇA ULTRA-ROBUSTAS

-- =================== CLIENTES ===================
-- 1. NEGAR TUDO por padrão (Default Deny)
CREATE POLICY "clientes_deny_all_by_default"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2. PERMITIR para admins/gerentes da MESMA empresa
CREATE POLICY "clientes_admins_same_company_full"
ON public.clientes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 3. PERMITIR SDRs ver APENAS clientes que criaram (READ-ONLY)
CREATE POLICY "clientes_sdr_own_created_readonly"
ON public.clientes  
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- =================== CONTATOS ===================
-- 1. NEGAR TUDO por padrão (Default Deny)
CREATE POLICY "contatos_deny_all_by_default"
ON public.contatos
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2. PERMITIR para admins/gerentes da MESMA empresa
CREATE POLICY "contatos_admins_same_company_full"
ON public.contatos
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 3. PERMITIR usuários ver APENAS contatos atribuídos diretamente
CREATE POLICY "contatos_user_assigned_only_readonly"
ON public.contatos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND responsavel_email = get_current_user_email()
);

-- =================== EMPRESAS ===================
-- 1. NEGAR TUDO por padrão (Default Deny)
CREATE POLICY "empresas_deny_all_by_default"
ON public.empresas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2. PERMITIR apenas administradores gerenciar dados da empresa
CREATE POLICY "empresas_admins_only_manage"
ON public.empresas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3. PERMITIR usuários ver dados básicos da SUA empresa ativa (READ-ONLY)
CREATE POLICY "empresas_users_own_company_readonly"
ON public.empresas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = get_user_active_company(auth.uid()));

-- =================== PROFILES ===================
-- 1. NEGAR TUDO por padrão (Default Deny)
CREATE POLICY "profiles_deny_all_by_default"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2. PERMITIR usuários ver/editar APENAS seu próprio perfil
CREATE POLICY "profiles_users_own_only_full"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. PERMITIR administradores gerenciar todos os perfis
CREATE POLICY "profiles_admins_manage_all"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 4. PERMITIR sistema inserir novos perfis (para signup)
CREATE POLICY "profiles_system_insert_new_users"
ON public.profiles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =================== VENDAS ===================
-- 1. NEGAR TUDO por padrão (Default Deny)
CREATE POLICY "vendas_deny_all_by_default"
ON public.vendas
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2. PERMITIR admins/gerentes da MESMA empresa ver/modificar todas as vendas
CREATE POLICY "vendas_admins_same_company_full"
ON public.vendas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso, 
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- 3. PERMITIR vendedores ver APENAS suas próprias vendas (READ-ONLY)
CREATE POLICY "vendas_users_own_sales_readonly"
ON public.vendas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND vendedor_id = auth.uid()
);

-- =================== RECRIAR POLÍTICAS PARA OUTRAS TABELAS ===================

-- EVENTOS PROSPECÇÃO
CREATE POLICY "eventos_prospeccao_company_users"
ON public.eventos_prospeccao
FOR ALL
TO authenticated
USING (
  prospeccao_id IN (
    SELECT id FROM public.prospeccoes 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  prospeccao_id IN (
    SELECT id FROM public.prospeccoes 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
);

-- GATILHOS
CREATE POLICY "gatilhos_company_users"
ON public.gatilhos
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- HORÁRIOS TRABALHO
CREATE POLICY "horarios_admins_manage"
ON public.horarios_trabalho
FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "horarios_users_view_own"
ON public.horarios_trabalho
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- DEMAIS TABELAS (manter funcionamento básico)
CREATE POLICY "itens_venda_company_users"
ON public.itens_venda
FOR ALL
TO authenticated
USING (
  venda_id IN (
    SELECT id FROM public.vendas 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  venda_id IN (
    SELECT id FROM public.vendas 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
);

CREATE POLICY "logs_movimentacao_company_users"
ON public.logs_movimentacao_contatos
FOR ALL
TO authenticated
USING (
  prospeccao_id IN (
    SELECT id FROM public.prospeccoes 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  prospeccao_id IN (
    SELECT id FROM public.prospeccoes 
    WHERE empresa_id = get_user_active_company(auth.uid())
  )
);

CREATE POLICY "metas_company_users"
ON public.metas
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "notificacoes_users_sent"
ON public.notificacoes
FOR ALL
TO authenticated
USING (remetente_id = auth.uid());

CREATE POLICY "notificacoes_users_received"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (destinatario_id = auth.uid());

CREATE POLICY "participacoes_treinamento_users_view"
ON public.participacoes_treinamento
FOR SELECT
TO authenticated
USING (participante_id = auth.uid());

CREATE POLICY "personas_company_users"
ON public.personas
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "produtos_company_users"
ON public.produtos
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "prospeccoes_company_users"
ON public.prospeccoes
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "relatorios_company_users"
ON public.relatorios
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "tipos_notificacao_admins_only"
ON public.tipos_notificacao
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "treinamentos_company_users"
ON public.treinamentos
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "user_empresas_admins_manage"
ON public.user_empresas
FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "user_empresas_users_update_active"
ON public.user_empresas
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_empresas_users_view_own"
ON public.user_empresas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
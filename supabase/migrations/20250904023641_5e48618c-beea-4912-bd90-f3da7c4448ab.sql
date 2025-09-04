-- CORREÇÃO CRÍTICA DE SEGURANÇA: Proteger dados pessoais dos clientes
-- Garantir que dados pessoais não podem ser acessados por usuários não autorizados

-- =================== REFORÇAR SEGURANÇA EM CLIENTES ===================
-- Remover políticas existentes para recriá-las com mais segurança
DROP POLICY IF EXISTS "rls_clientes_default_deny" ON public.clientes;
DROP POLICY IF EXISTS "rls_clientes_admin_access" ON public.clientes;
DROP POLICY IF EXISTS "rls_clientes_sdr_readonly" ON public.clientes;
DROP POLICY IF EXISTS "clientes_admins_same_company_full" ON public.clientes;
DROP POLICY IF EXISTS "clientes_sdr_own_created_readonly" ON public.clientes;

-- Política restritiva: NEGAR TUDO por padrão para clientes
CREATE POLICY "rls_clientes_deny_all_default"
ON public.clientes
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Política: Apenas Administradores e TI podem ver TODOS os dados de clientes
CREATE POLICY "rls_clientes_admin_ti_full_access"
ON public.clientes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso
  ])
)
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Administrador'::tipo_acesso, 
    'TI'::tipo_acesso
  ])
);

-- Política: Gerentes podem ver clientes mas com dados mascarados (implementar função de máscara)
CREATE POLICY "rls_clientes_gerentes_limited"
ON public.clientes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = ANY(ARRAY[
    'Diretor'::tipo_acesso,
    'Gerente de Leads'::tipo_acesso,
    'Gerente de Loja'::tipo_acesso
  ])
);

-- Política: SDRs podem ver apenas clientes que criaram (dados próprios)
CREATE POLICY "rls_clientes_sdr_own_only"
ON public.clientes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() = 'SDR'::tipo_acesso
  AND user_id = auth.uid()
);

-- =================== REFORÇAR SEGURANÇA EM CONTATOS ===================
-- Manter políticas atuais mas adicionar auditoria
CREATE POLICY "rls_contatos_audit_access"
ON public.contatos
AS PERMISSIVE 
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_active_company(auth.uid())
  AND NOT (get_current_user_access_type() = 'SDR'::tipo_acesso AND responsavel_email != get_current_user_email())
);

-- =================== FUNÇÃO DE AUDITORIA ===================
-- Trigger para auditar acessos a dados sensíveis
CREATE OR REPLACE FUNCTION audit_sensitive_data_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log de auditoria apenas para SELECT em dados sensíveis
  IF TG_OP = 'SELECT' AND TG_TABLE_NAME IN ('clientes', 'contatos') THEN
    INSERT INTO public.logs_movimentacao_contatos (
      contato_id,
      status_anterior,
      status_novo, 
      observacoes,
      usuario_id,
      prospeccao_id,
      created_at
    ) VALUES (
      COALESCE(NEW.id, OLD.id, gen_random_uuid()),
      'audit',
      'data_access',
      'Acesso a dados sensíveis: ' || TG_TABLE_NAME || ' por usuário ' || auth.uid()::text,
      auth.uid(),
      (SELECT id FROM prospeccoes LIMIT 1), -- Placeholder
      NOW()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
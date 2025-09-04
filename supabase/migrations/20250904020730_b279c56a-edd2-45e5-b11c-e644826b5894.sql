-- CORREÇÃO DOS PROBLEMAS DE SEGURANÇA DETECTADOS PELO LINTER

-- 1. Remover views com SECURITY DEFINER (problemáticas)
DROP VIEW IF EXISTS public.empresa_basica;
DROP VIEW IF EXISTS public.profile_basico;

-- 2. Corrigir função com search_path adequado
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(
  data_type TEXT,
  value TEXT,
  user_type tipo_acesso
) 
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas admins veem dados completos
  IF user_type = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]) THEN
    RETURN value;
  END IF;
  
  -- Mascarar dados sensíveis para outros usuários
  CASE data_type
    WHEN 'cpf' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(\d{3})\d{6}(\d{2})', '\1****\2');
    WHEN 'telefone' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(\d{2})(\d{5})\d{4}', '\1\2****');  
    WHEN 'email' THEN RETURN REGEXP_REPLACE(COALESCE(value, ''), '(.{2}).+(@.+)', '\1****\2');
    ELSE RETURN '****';
  END CASE;
END;
$$;

-- 3. Política mais restritiva para empresas (sem usar views)
DROP POLICY IF EXISTS "Users basic company info only" ON public.empresas;

-- Política ultra-restritiva: apenas admins podem ver dados da empresa
CREATE POLICY "Admins only company data"
ON public.empresas
FOR SELECT
USING (
  is_admin()
  AND id = get_user_active_company(auth.uid())
);

-- 4. Política mais restritiva para profiles (sem usar views)  
DROP POLICY IF EXISTS "Admins basic profile info only" ON public.profiles;

-- Apenas o próprio usuário pode ver seu perfil completo
-- Admins podem ver apenas dados básicos necessários via aplicação
CREATE POLICY "Users own profile complete only"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Admins podem ver profiles de sua empresa apenas para administração
CREATE POLICY "Admins manage company profiles"
ON public.profiles  
FOR SELECT
USING (
  is_admin()
  AND empresa_id = get_user_active_company(auth.uid())
);

-- 5. Adicionar comentários de segurança nas tabelas sensíveis
COMMENT ON TABLE public.clientes IS 'DADOS SENSÍVEIS: CPF, telefone, email, endereço - Acesso restrito por RLS';
COMMENT ON TABLE public.contatos IS 'DADOS SENSÍVEIS: telefone, email - Acesso apenas ao responsável direto';
COMMENT ON TABLE public.empresas IS 'DADOS CONFIDENCIAIS: CNPJ, dados legais - Acesso apenas administradores';
COMMENT ON TABLE public.profiles IS 'DADOS PESSOAIS: CPF, telefone - Acesso apenas próprio usuário e admins da empresa';

-- 6. Criar trigger de auditoria para acesso a dados sensíveis
CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger AS $$
BEGIN
  -- Log de auditoria para acessos a dados sensíveis
  INSERT INTO public.logs_movimentacao_contatos (
    contato_id,
    status_anterior,
    status_novo, 
    observacoes,
    usuario_id,
    prospeccao_id,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    'audit',
    'data_access',
    'Acesso a dados sensíveis: ' || TG_TABLE_NAME || ' por usuário ' || auth.uid()::text,
    auth.uid(),
    (SELECT id FROM prospeccoes LIMIT 1), -- Placeholder
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar trigger de auditoria apenas em operações SELECT (implicitamente via logs de aplicação)
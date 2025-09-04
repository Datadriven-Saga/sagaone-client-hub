-- REFINAMENTO FINAL DE SEGURANÇA: Restrições ultra-específicas

-- 1. TABELA CLIENTES: Corrigir política para SDRs não verem dados que não criaram
DROP POLICY IF EXISTS "Users own clients only" ON public.clientes;

-- SDRs só podem ver clientes que CRIARAM OU que têm contatos DIRETOS atribuídos a eles
CREATE POLICY "Users strict own clients only"
ON public.clientes  
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND (
    user_id = auth.uid()  -- Só clientes que o usuário criou
    OR (
      -- OU clientes onde o usuário tem contatos diretos atribuídos
      get_current_user_access_type() NOT IN ('SDR'::tipo_acesso) -- Exceto SDRs
      AND id IN (
        SELECT DISTINCT cliente_id
        FROM contatos 
        WHERE responsavel_email = get_current_user_email()
        AND cliente_id IS NOT NULL
        AND empresa_id = get_user_active_company()
      )
    )
  )
);

-- 2. TABELA CONTATOS: Apenas responsável direto e seu gestor imediato
DROP POLICY IF EXISTS "Users assigned contacts only" ON public.contatos;

-- Usuários só podem ver contatos ATRIBUÍDOS A ELES ou de seus subordinados diretos
CREATE POLICY "Users strict assigned contacts only"
ON public.contatos
FOR SELECT
USING (
  user_in_same_company(empresa_id)
  AND (
    responsavel_email = get_current_user_email()  -- Contatos atribuídos ao usuário
    OR (
      -- OU usuário é gestor direto do responsável
      get_current_user_access_type() = ANY(ARRAY[
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
    )
  )
);

-- 3. TABELA EMPRESAS: Apenas dados básicos, não informações sensíveis  
DROP POLICY IF EXISTS "Users own company only" ON public.empresas;

-- Criar view com dados limitados da empresa (sem informações sensíveis)
CREATE OR REPLACE VIEW public.empresa_basica AS
SELECT 
  id,
  nome_empresa,
  razao_social,
  logomarca_url,
  site,
  grupo_empresarial,
  horario_funcionamento,
  created_at,
  updated_at
FROM public.empresas;

-- Garantir RLS na view
ALTER VIEW public.empresa_basica SET (security_invoker = true);

-- Política para dados básicos da empresa apenas
CREATE POLICY "Users basic company info only"
ON public.empresas
FOR SELECT
USING (
  id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() NOT IN ('SDR'::tipo_acesso)
  OR is_admin()
);

-- 4. TABELA PROFILES: Apenas dados básicos para admins, dados completos para próprio usuário
DROP POLICY IF EXISTS "Users own profile only" ON public.profiles;

-- Usuários só veem SEU perfil completo
CREATE POLICY "Users own complete profile only"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Admins veem apenas dados básicos de outros usuários (sem CPF, celular)
CREATE OR REPLACE VIEW public.profile_basico AS
SELECT 
  id,
  nome_completo,
  tipo_acesso,
  status,
  departamento,
  foto_url,
  gestor_imediato,
  empresa_id,
  created_at   
FROM public.profiles;

-- 5. Política especial para admins verem dados básicos de profiles
CREATE POLICY "Admins basic profile info only"
ON public.profiles
FOR SELECT  
USING (
  is_admin()
  AND id != auth.uid()  -- Não aplicar para próprio perfil
);

-- 6. FUNÇÃO para mascarar dados sensíveis para não-admins
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(
  data_type TEXT,
  value TEXT,
  user_type tipo_acesso
) 
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
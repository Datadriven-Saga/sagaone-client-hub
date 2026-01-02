-- Remover política existente
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Criar política mais restritiva
-- Usuários regulares só veem seu próprio perfil
-- Gerentes/Diretores podem ver perfis da empresa (devem usar profiles_safe para dados mascarados)
-- Admin/TI podem ver todos os perfis da empresa
CREATE POLICY "profiles_select_restricted" 
ON public.profiles 
FOR SELECT 
USING (
  -- Sempre pode ver o próprio perfil
  (id = auth.uid()) OR 
  -- Administradores podem ver todos
  is_admin() OR 
  -- TI pode ver perfis da mesma empresa
  (get_current_user_access_type() = 'TI'::tipo_acesso AND empresa_id = get_user_active_company(auth.uid())) OR
  -- Gerentes podem ver perfis da mesma empresa
  ((empresa_id = get_user_active_company(auth.uid())) AND 
   (get_current_user_access_type() = ANY (ARRAY['Diretor'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso])))
);

-- Criar uma política mais restritiva para a view profiles_safe
-- Permitir que TODOS os usuários autenticados vejam a view (dados já são mascarados)
-- Isso permite listar colegas para funcionalidades como atribuição de leads

-- Primeiro, garantir que a view usa security_invoker
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.nome_completo,
  -- CPF visível apenas para o próprio usuário ou Admin/TI
  CASE 
    WHEN p.id = auth.uid() OR is_admin() OR 
         get_current_user_access_type() = 'TI'::tipo_acesso
    THEN p.cpf
    ELSE CASE 
      WHEN p.cpf IS NOT NULL THEN '***.***.***-**'
      ELSE NULL 
    END
  END as cpf,
  -- Celular visível apenas para o próprio usuário ou Admin/TI
  CASE 
    WHEN p.id = auth.uid() OR is_admin() OR 
         get_current_user_access_type() = 'TI'::tipo_acesso
    THEN p.celular
    ELSE CASE 
      WHEN p.celular IS NOT NULL THEN '(**) *****-****'
      ELSE NULL 
    END
  END as celular,
  p.foto_url,
  p.departamento,
  p.status,
  p.tipo_acesso,
  p.empresa_id,
  p.gestor_imediato,
  p.notificacao_whatsapp,
  p.notificacao_email,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE 
  -- Qualquer usuário pode ver perfis da mesma empresa na view (dados sensíveis mascarados)
  p.empresa_id = get_user_active_company(auth.uid());

GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS 'View segura de profiles que mascara CPF e celular. Usuários só veem colegas da mesma empresa com dados sensíveis protegidos.';
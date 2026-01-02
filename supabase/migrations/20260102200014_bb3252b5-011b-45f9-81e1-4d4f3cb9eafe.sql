-- Criar view segura que mascara dados sensíveis para não-admins
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  nome_completo,
  -- CPF visível apenas para o próprio usuário ou Admin/TI
  CASE 
    WHEN id = auth.uid() OR is_admin() OR 
         get_current_user_access_type() = 'TI'::tipo_acesso
    THEN cpf
    ELSE CASE 
      WHEN cpf IS NOT NULL THEN '***.***.***-**'
      ELSE NULL 
    END
  END as cpf,
  -- Celular visível apenas para o próprio usuário ou Admin/TI
  CASE 
    WHEN id = auth.uid() OR is_admin() OR 
         get_current_user_access_type() = 'TI'::tipo_acesso
    THEN celular
    ELSE CASE 
      WHEN celular IS NOT NULL THEN '(**) *****-****'
      ELSE NULL 
    END
  END as celular,
  foto_url,
  departamento,
  status,
  tipo_acesso,
  empresa_id,
  gestor_imediato,
  notificacao_whatsapp,
  notificacao_email,
  created_at,
  updated_at
FROM public.profiles;

-- Conceder acesso à view para usuários autenticados
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Atualizar política de SELECT para ser mais restritiva na tabela base
-- Primeiro, remover a política existente
DROP POLICY IF EXISTS "profiles_managers_view_company" ON public.profiles;

-- Recriar política de SELECT mais restritiva
-- Apenas admins e TI podem ver todos os perfis completos
-- Gerentes podem ver perfis da empresa mas devem usar a view segura para dados mascarados
CREATE POLICY "profiles_select_policy" 
ON public.profiles 
FOR SELECT 
USING (
  (id = auth.uid()) OR 
  is_admin() OR 
  (get_current_user_access_type() = 'TI'::tipo_acesso AND empresa_id = get_user_active_company(auth.uid())) OR
  ((empresa_id = get_user_active_company(auth.uid())) AND 
   (get_current_user_access_type() = ANY (ARRAY['Diretor'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso])))
);

-- Adicionar comentário explicando o uso da view
COMMENT ON VIEW public.profiles_safe IS 'View segura de profiles que mascara CPF e celular para usuários não-admin. Use esta view para listar usuários sem expor dados sensíveis.';
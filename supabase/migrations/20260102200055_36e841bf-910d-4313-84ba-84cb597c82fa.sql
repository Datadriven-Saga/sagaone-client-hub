-- Recriar view sem SECURITY DEFINER (usar SECURITY INVOKER por padrão)
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
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

-- Adicionar comentário explicando o uso da view
COMMENT ON VIEW public.profiles_safe IS 'View segura de profiles que mascara CPF e celular para usuários não-admin. Use esta view para listar usuários sem expor dados sensíveis.';
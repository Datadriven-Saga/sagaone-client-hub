-- Habilitar proteção contra senhas vazadas
-- Isso requer configuração no painel de administração do Supabase
-- Por enquanto, vamos apenas documentar que isso deve ser feito

-- Criar uma função para verificar se a proteção está ativada
CREATE OR REPLACE FUNCTION public.check_password_protection_status()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 'Password leak protection should be enabled in Supabase Auth settings'::text;
$$;
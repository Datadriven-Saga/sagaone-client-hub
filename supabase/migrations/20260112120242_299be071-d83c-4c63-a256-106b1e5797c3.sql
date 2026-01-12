-- Função para validar domínio do email
CREATE OR REPLACE FUNCTION public.validate_email_domain(email_input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Permite apenas emails do domínio @gruposaga.com.br
    RETURN email_input ILIKE '%@gruposaga.com.br';
END;
$$;

-- Função para bloquear login de domínios não autorizados
-- Esta função será chamada após o login para validar o domínio
CREATE OR REPLACE FUNCTION public.check_user_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verifica se o email do novo usuário pertence ao domínio permitido
    IF NOT (NEW.email ILIKE '%@gruposaga.com.br') THEN
        RAISE EXCEPTION 'Apenas emails do domínio @gruposaga.com.br são permitidos';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para validar novos usuários (isso é informativo, pois auth.users é gerenciado pelo Supabase)
-- A validação principal será feita no edge function e no frontend
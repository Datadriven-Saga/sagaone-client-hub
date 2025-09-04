-- Corrigir inconsistência de empresa no perfil do usuário
UPDATE public.profiles 
SET empresa_id = (
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = true
), updated_at = now()
WHERE id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00';

-- Corrigir o trigger que impede administradores de criarem usuários
-- Modificar a função para permitir que administradores alterem qualquer campo
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current user's access type
  DECLARE
    current_user_access tipo_acesso;
  BEGIN
    SELECT tipo_acesso INTO current_user_access 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Only admins can modify sensitive fields
    IF current_user_access != 'Administrador'::tipo_acesso THEN
      -- Prevent changes to sensitive fields for non-admins
      IF OLD.tipo_acesso IS DISTINCT FROM NEW.tipo_acesso THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar tipo de acesso';
      END IF;
      
      IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar empresa associada';
      END IF;
      
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar status do usuário';
      END IF;
    END IF;
    
    RETURN NEW;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      -- If user doesn't have a profile yet (new user creation), allow it
      RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
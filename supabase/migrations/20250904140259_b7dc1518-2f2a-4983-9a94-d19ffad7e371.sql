-- Remover temporariamente o trigger para fazer correções
DROP TRIGGER IF EXISTS prevent_privilege_escalation_profiles_trigger ON public.profiles;

-- Corrigir inconsistência de empresa no perfil do usuário
UPDATE public.profiles 
SET empresa_id = (
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = true
), updated_at = now()
WHERE id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00';

-- Recriar a função corrigida
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
    
    -- Only check restrictions for non-admins and when not creating new users
    IF current_user_access != 'Administrador'::tipo_acesso AND OLD IS NOT NULL THEN
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
      -- If user doesn't have a profile yet or during user creation, allow it
      RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar o trigger
CREATE TRIGGER prevent_privilege_escalation_profiles_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation_profiles();
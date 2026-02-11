-- Update is_admin function to recognize Master role
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND tipo_acesso IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso)
  );
$function$;

-- Update check_user_is_admin to recognize Master role
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_id_param uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = user_id_param 
        AND tipo_acesso IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso)
      ) THEN true
      ELSE false
    END;
$function$;

-- Update can_manage_users to recognize Master role
CREATE OR REPLACE FUNCTION public.can_manage_users(user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = user_id
    AND tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
  );
$function$;

-- Update get_current_user_access_type to return tipo_acesso properly
-- (no change needed, it already returns the raw value)

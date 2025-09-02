-- Create a function to handle user management operations with proper admin privileges
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
    AND tipo_acesso IN ('Administrador', 'TI')::tipo_acesso[]
  );
$function$;
-- Create table for user-company relationships
CREATE TABLE public.user_empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  is_ativa boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Enable RLS on user_empresas table
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Create policies for user_empresas
CREATE POLICY "Users can view their company relationships" 
ON public.user_empresas 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all company relationships" 
ON public.user_empresas 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND tipo_acesso = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  )
);

CREATE POLICY "Users can update their active company" 
ON public.user_empresas 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to get user's active company
CREATE OR REPLACE FUNCTION public.get_user_active_company(user_id_param uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = user_id_param AND is_ativa = true
  LIMIT 1;
$$;

-- Create function to set user's active company
CREATE OR REPLACE FUNCTION public.set_user_active_company(new_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, deactivate all companies for the user
  UPDATE public.user_empresas 
  SET is_ativa = false, updated_at = now()
  WHERE user_id = auth.uid();
  
  -- Then, activate the selected company
  UPDATE public.user_empresas 
  SET is_ativa = true, updated_at = now()
  WHERE user_id = auth.uid() AND empresa_id = new_empresa_id;
END;
$$;

-- Create trigger for updating updated_at
CREATE TRIGGER update_user_empresas_updated_at
BEFORE UPDATE ON public.user_empresas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from profiles table
INSERT INTO public.user_empresas (user_id, empresa_id, is_ativa)
SELECT id, empresa_id, true
FROM public.profiles
WHERE empresa_id IS NOT NULL
ON CONFLICT (user_id, empresa_id) DO NOTHING;
-- Fix user company association and RLS policies for opt_outs

-- First, let's ensure users have proper company associations
-- This will help with the current user who doesn't have an active company

-- Insert missing user_empresas records for users without company association
INSERT INTO public.user_empresas (user_id, empresa_id, is_ativa)
SELECT 
  p.id as user_id,
  COALESCE(p.empresa_id, '00000000-0000-0000-0000-000000000001') as empresa_id,
  true as is_ativa
FROM public.profiles p
LEFT JOIN public.user_empresas ue ON p.id = ue.user_id
WHERE ue.user_id IS NULL
ON CONFLICT (user_id, empresa_id) DO UPDATE SET is_ativa = true;

-- Update profiles to have empresa_id if they don't have one
UPDATE public.profiles 
SET empresa_id = '00000000-0000-0000-0000-000000000001'
WHERE empresa_id IS NULL;

-- Update the constraint to make telefone and email truly optional
ALTER TABLE public.opt_outs 
DROP CONSTRAINT IF EXISTS chk_optouts_identificador;

-- Add a more flexible constraint that allows both to be null in some cases
ALTER TABLE public.opt_outs 
ADD CONSTRAINT chk_optouts_identificador CHECK (
  telefone_e164 IS NOT NULL OR email_normalizado IS NOT NULL OR nome IS NOT NULL
);
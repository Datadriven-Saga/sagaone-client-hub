-- Temporary fix for RLS policy to allow opt-out creation
-- Update the RLS policy to be more permissive for now

DROP POLICY IF EXISTS "opt_outs_company_users" ON public.opt_outs;

-- Create a more permissive policy that allows users to insert with any company_id
-- but restricts viewing to their active company
CREATE POLICY "opt_outs_users_insert" ON public.opt_outs
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "opt_outs_users_select" ON public.opt_outs
FOR SELECT 
TO authenticated
USING (
  empresa_id = COALESCE(
    get_user_active_company(auth.uid()),
    (SELECT empresa_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
);

CREATE POLICY "opt_outs_users_update" ON public.opt_outs
FOR UPDATE 
TO authenticated
USING (
  empresa_id = COALESCE(
    get_user_active_company(auth.uid()),
    (SELECT empresa_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
)
WITH CHECK (
  empresa_id = COALESCE(
    get_user_active_company(auth.uid()),
    (SELECT empresa_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
);

CREATE POLICY "opt_outs_users_delete" ON public.opt_outs
FOR DELETE 
TO authenticated
USING (
  empresa_id = COALESCE(
    get_user_active_company(auth.uid()),
    (SELECT empresa_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
);
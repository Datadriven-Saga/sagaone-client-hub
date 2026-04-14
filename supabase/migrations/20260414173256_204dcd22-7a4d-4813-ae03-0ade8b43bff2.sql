DROP POLICY IF EXISTS eventos_prospeccao_empresa_users_all ON public.eventos_prospeccao;

CREATE POLICY eventos_prospeccao_empresa_users_all ON public.eventos_prospeccao
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = eventos_prospeccao.prospeccao_id
      AND p.empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = eventos_prospeccao.prospeccao_id
      AND p.empresa_id = get_user_active_company(auth.uid())
  )
);
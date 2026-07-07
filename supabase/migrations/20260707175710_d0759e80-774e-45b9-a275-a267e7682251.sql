
DROP POLICY IF EXISTS "cadencias select via prospeccao" ON public.prospeccao_cadencias;
DROP POLICY IF EXISTS "cadencias insert via prospeccao" ON public.prospeccao_cadencias;
DROP POLICY IF EXISTS "cadencias update via prospeccao" ON public.prospeccao_cadencias;
DROP POLICY IF EXISTS "cadencias delete via prospeccao" ON public.prospeccao_cadencias;

CREATE POLICY "cadencias select via prospeccao"
  ON public.prospeccao_cadencias FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = prospeccao_cadencias.prospeccao_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  ));

CREATE POLICY "cadencias insert via prospeccao"
  ON public.prospeccao_cadencias FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = prospeccao_cadencias.prospeccao_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  ));

CREATE POLICY "cadencias update via prospeccao"
  ON public.prospeccao_cadencias FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = prospeccao_cadencias.prospeccao_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = prospeccao_cadencias.prospeccao_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  ));

CREATE POLICY "cadencias delete via prospeccao"
  ON public.prospeccao_cadencias FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.prospeccoes p
    WHERE p.id = prospeccao_cadencias.prospeccao_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  ));

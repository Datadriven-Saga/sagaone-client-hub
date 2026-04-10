
DROP POLICY IF EXISTS "timeline_insert" ON public.contato_timeline;

CREATE POLICY "timeline_insert" ON public.contato_timeline FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contatos c
      WHERE c.id = contato_timeline.contato_id
        AND public.user_can_access_empresa(c.empresa_id, auth.uid())
    )
  );

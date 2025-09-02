-- Apenas administradores podem gerenciar tipos de notificação (inserir, atualizar, deletar)
CREATE POLICY "Administradores podem inserir tipos de notificação" 
ON public.tipos_notificacao 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Administradores podem atualizar tipos de notificação" 
ON public.tipos_notificacao 
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Administradores podem deletar tipos de notificação" 
ON public.tipos_notificacao 
FOR DELETE 
TO authenticated
USING (is_admin());
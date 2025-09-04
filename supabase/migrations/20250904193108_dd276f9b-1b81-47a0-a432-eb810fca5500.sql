-- Habilitar RLS nas tabelas eventos_prospeccao e logs_movimentacao_contatos
ALTER TABLE public.eventos_prospeccao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_movimentacao_contatos ENABLE ROW LEVEL SECURITY;

-- Política para eventos_prospeccao - baseada na empresa dos contatos relacionados
CREATE POLICY "eventos_prospeccao_empresa_users_all"
ON public.eventos_prospeccao
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contatos c 
    WHERE c.id = eventos_prospeccao.contato_id 
    AND c.empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contatos c 
    WHERE c.id = eventos_prospeccao.contato_id 
    AND c.empresa_id = get_user_active_company(auth.uid())
  )
);

-- Política para logs_movimentacao_contatos - baseada na empresa dos contatos relacionados  
CREATE POLICY "logs_movimentacao_contatos_empresa_users_all"
ON public.logs_movimentacao_contatos
FOR ALL
TO authenticated  
USING (
  EXISTS (
    SELECT 1 FROM public.contatos c 
    WHERE c.id = logs_movimentacao_contatos.contato_id 
    AND c.empresa_id = get_user_active_company(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contatos c 
    WHERE c.id = logs_movimentacao_contatos.contato_id 
    AND c.empresa_id = get_user_active_company(auth.uid())
  )
);
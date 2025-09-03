-- Remover políticas existentes de eventos_prospeccao
DROP POLICY IF EXISTS "Users can manage prospecting events from their active company" ON public.eventos_prospeccao;

-- Criar nova política para eventos de prospecção
CREATE POLICY "Users can manage prospecting events from their active company" 
ON public.eventos_prospeccao 
FOR ALL 
USING (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
)
WITH CHECK (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
);

-- Constraint para garantir que um contato só pode ser vinculado uma vez por prospecção
CREATE UNIQUE INDEX IF NOT EXISTS unique_contato_prospeccao_eventos 
ON public.eventos_prospeccao (contato_id, prospeccao_id);

-- Atualizar políticas de logs de movimentação para usar empresa ativa
DROP POLICY IF EXISTS "Usuários podem inserir logs da empresa" ON public.logs_movimentacao_contatos;
DROP POLICY IF EXISTS "Usuários podem ver logs da empresa" ON public.logs_movimentacao_contatos;

CREATE POLICY "Users can manage logs from their active company" 
ON public.logs_movimentacao_contatos 
FOR ALL 
USING (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
)
WITH CHECK (
    prospeccao_id IN (
        SELECT id FROM public.prospeccoes 
        WHERE empresa_id = get_user_active_company()
    )
);
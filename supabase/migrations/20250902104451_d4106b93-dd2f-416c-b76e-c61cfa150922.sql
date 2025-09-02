-- Fix security issues with RLS policies

-- 1. Fix tipos_notificacao table - restrict SELECT to administrators only
DROP POLICY IF EXISTS "Usuários autenticados podem ver tipos de notificação" ON public.tipos_notificacao;

CREATE POLICY "Administradores podem ver tipos de notificação" 
ON public.tipos_notificacao 
FOR SELECT 
USING (is_admin());

-- 2. Add missing RLS policies for eventos_prospeccao table
CREATE POLICY "Usuários podem inserir eventos de prospecção" 
ON public.eventos_prospeccao 
FOR INSERT 
WITH CHECK (prospeccao_id IN ( 
  SELECT prospeccoes.id
  FROM prospeccoes
  WHERE prospeccoes.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Usuários podem atualizar eventos de prospecção" 
ON public.eventos_prospeccao 
FOR UPDATE 
USING (prospeccao_id IN ( 
  SELECT prospeccoes.id
  FROM prospeccoes
  WHERE prospeccoes.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Usuários podem deletar eventos de prospecção" 
ON public.eventos_prospeccao 
FOR DELETE 
USING (prospeccao_id IN ( 
  SELECT prospeccoes.id
  FROM prospeccoes
  WHERE prospeccoes.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

-- 3. Add missing RLS policies for itens_venda table
CREATE POLICY "Usuários podem inserir itens de venda" 
ON public.itens_venda 
FOR INSERT 
WITH CHECK (venda_id IN ( 
  SELECT vendas.id
  FROM vendas
  WHERE vendas.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Usuários podem atualizar itens de venda" 
ON public.itens_venda 
FOR UPDATE 
USING (venda_id IN ( 
  SELECT vendas.id
  FROM vendas
  WHERE vendas.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Usuários podem deletar itens de venda" 
ON public.itens_venda 
FOR DELETE 
USING (venda_id IN ( 
  SELECT vendas.id
  FROM vendas
  WHERE vendas.empresa_id IN ( 
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));
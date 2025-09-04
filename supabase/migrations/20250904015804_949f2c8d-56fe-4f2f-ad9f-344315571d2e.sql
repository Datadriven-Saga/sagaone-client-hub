-- Primeiro, remover as políticas RLS que dependem de responsavel_id
DROP POLICY IF EXISTS "Users can access their assigned contacts" ON public.contatos;
DROP POLICY IF EXISTS "Users can access their assigned clients" ON public.clientes;

-- Adicionar coluna responsavel_email ANTES de remover responsavel_id
ALTER TABLE public.contatos 
ADD COLUMN IF NOT EXISTS responsavel_email TEXT;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contatos_responsavel_email ON public.contatos(responsavel_email);

-- Agora remover a coluna responsavel_id
ALTER TABLE public.contatos 
DROP COLUMN IF EXISTS responsavel_id CASCADE;

-- Recriar as políticas RLS usando email
CREATE POLICY "Users can access their assigned contacts" 
ON public.contatos 
FOR ALL
USING (
  empresa_id = get_user_active_company() 
  AND (
    responsavel_email IS NULL 
    OR responsavel_email IN (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  empresa_id = get_user_active_company() 
  AND (
    responsavel_email IS NULL 
    OR responsavel_email IN (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
);

-- Recriar política para clientes (sem responsavel_id)
CREATE POLICY "Users can access their assigned clients" 
ON public.clientes 
FOR ALL
USING (
  empresa_id = get_user_active_company() 
  AND (
    user_id = auth.uid() 
    OR id IN (
      SELECT DISTINCT c.cliente_id
      FROM contatos c
      WHERE c.responsavel_email IN (
        SELECT email 
        FROM auth.users 
        WHERE id = auth.uid()
      )
      AND c.cliente_id IS NOT NULL
      AND c.empresa_id = get_user_active_company()
    )
  )
)
WITH CHECK (
  empresa_id = get_user_active_company() 
  AND (
    user_id = auth.uid() 
    OR get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso, 
      'Gerente de Leads'::tipo_acesso, 
      'Gerente de Loja'::tipo_acesso
    ])
  )
);
-- RESETAR PARA FUNCIONALIDADE BÁSICA
-- Remover todas as políticas complexas e criar políticas simples que funcionem

-- =================== CONTATOS - POLÍTICAS SIMPLES ===================
DO $$
DECLARE
    pol record;
BEGIN
    -- Remover todas as políticas da tabela contatos
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'contatos' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.contatos';
    END LOOP;
END $$;

-- Política simples: Usuários da mesma empresa podem fazer tudo com contatos
CREATE POLICY "contatos_empresa_users_all"
ON public.contatos
AS PERMISSIVE
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- =================== CLIENTES - POLÍTICAS SIMPLES ===================
DO $$
DECLARE
    pol record;
BEGIN
    -- Remover todas as políticas da tabela clientes
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clientes' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.clientes';
    END LOOP;
END $$;

-- Política simples: Usuários da mesma empresa podem fazer tudo com clientes
CREATE POLICY "clientes_empresa_users_all"
ON public.clientes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- =================== PROSPECCOES - GARANTIR FUNCIONALIDADE ===================
DO $$
DECLARE
    pol record;
BEGIN
    -- Remover todas as políticas da tabela prospeccoes
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'prospeccoes' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.prospeccoes';
    END LOOP;
END $$;

-- Política simples: Usuários da mesma empresa podem fazer tudo com prospecções
CREATE POLICY "prospeccoes_empresa_users_all"
ON public.prospeccoes
AS PERMISSIVE
FOR ALL
TO authenticated
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));
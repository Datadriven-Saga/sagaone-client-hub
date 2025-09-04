-- LIMPEZA FINAL: Remover ABSOLUTAMENTE TODAS as políticas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname, tablename
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Agora forçar RLS em todas as tabelas
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contatos FORCE ROW LEVEL SECURITY; 
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendas FORCE ROW LEVEL SECURITY;
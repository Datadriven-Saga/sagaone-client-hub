-- ==========================================
-- CORREÇÕES DE SEGURANÇA RLS
-- Força RLS e cria políticas PERMISSIVE
-- ==========================================

-- 1. TABELA CLIENTES - Forçar RLS
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;

-- 2. TABELA AGENTE_INTEGRACOES - Forçar RLS  
ALTER TABLE public.agente_integracoes FORCE ROW LEVEL SECURITY;
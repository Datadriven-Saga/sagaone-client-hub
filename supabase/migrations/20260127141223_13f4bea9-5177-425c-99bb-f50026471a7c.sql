-- ==========================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS
-- ==========================================

-- 1. FIX: agentes_visao - Remover política pública e adicionar autenticação
DROP POLICY IF EXISTS "agentes_visao_users_select" ON public.agentes_visao;

CREATE POLICY "agentes_visao_authenticated_select" ON public.agentes_visao
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. FIX: cronograma_implantacao - Remover política pública e adicionar autenticação
DROP POLICY IF EXISTS "cronograma_implantacao_users_select" ON public.cronograma_implantacao;

CREATE POLICY "cronograma_implantacao_authenticated_select" ON public.cronograma_implantacao
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. FIX: profiles_safe view - Criar como view segura com RLS do profiles
-- Primeiro dropar a view se existir e recriar com SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  nome_completo,
  tipo_acesso,
  departamento,
  status,
  empresa_id,
  foto_url,
  created_at,
  updated_at
FROM public.profiles;

-- Adicionar comentário de segurança
COMMENT ON VIEW public.profiles_safe IS 'View segura de profiles que herda políticas RLS da tabela base';
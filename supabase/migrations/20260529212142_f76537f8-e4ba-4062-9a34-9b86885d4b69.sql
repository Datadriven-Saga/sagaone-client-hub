
-- Tornar campos de cotação/BRL nullable (log server-side guarda apenas USD)
ALTER TABLE public.logs_disparos
  ALTER COLUMN cotacao_dolar DROP NOT NULL,
  ALTER COLUMN cotacao_data DROP NOT NULL,
  ALTER COLUMN custo_total_brl DROP NOT NULL,
  ALTER COLUMN evento_nome DROP NOT NULL,
  ALTER COLUMN usuario_nome DROP NOT NULL,
  ALTER COLUMN usuario_email DROP NOT NULL,
  ALTER COLUMN usuario_perfil DROP NOT NULL;

-- Novas colunas de contexto (retrocompatíveis)
ALTER TABLE public.logs_disparos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id),
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS template_nome TEXT,
  ADD COLUMN IF NOT EXISTS tipo_evento TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'frontend',
  ADD COLUMN IF NOT EXISTS total_sucesso INTEGER,
  ADD COLUMN IF NOT EXISTS total_falha INTEGER,
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS batch_index INTEGER;

-- Índices para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_logs_disparos_created_at
  ON public.logs_disparos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_disparos_empresa_marca
  ON public.logs_disparos (empresa_id, marca);

CREATE INDEX IF NOT EXISTS idx_logs_disparos_job_id
  ON public.logs_disparos (job_id);

-- RPC para opções de filtro (substitui select full-table)
CREATE OR REPLACE FUNCTION public.get_logs_disparos_filtros()
RETURNS TABLE(usuarios TEXT[], eventos TEXT[], marcas TEXT[], ufs TEXT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ARRAY(SELECT DISTINCT usuario_email FROM public.logs_disparos WHERE usuario_email IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT evento_nome FROM public.logs_disparos WHERE evento_nome IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT marca FROM public.logs_disparos WHERE marca IS NOT NULL ORDER BY 1),
    ARRAY(SELECT DISTINCT uf FROM public.logs_disparos WHERE uf IS NOT NULL ORDER BY 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_logs_disparos_filtros() TO authenticated;

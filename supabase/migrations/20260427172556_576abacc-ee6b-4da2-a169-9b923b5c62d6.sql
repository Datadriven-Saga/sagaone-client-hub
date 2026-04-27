-- Tabela de jobs de ingestão
CREATE TABLE public.pool_ingestao_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  payload_recebido jsonb,
  total_recebido int DEFAULT 0,
  total_processado int DEFAULT 0,
  total_orfaos int DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT pool_ingestao_jobs_status_check CHECK (status IN ('pending', 'processing', 'done', 'error'))
);

CREATE INDEX idx_pool_ingestao_jobs_status ON public.pool_ingestao_jobs(status);
CREATE INDEX idx_pool_ingestao_jobs_created_at ON public.pool_ingestao_jobs(created_at DESC);

-- Tabela do pool de clientes externos
CREATE TABLE public.pool_clientes_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  codigo_proposta text NOT NULL,
  telefone text,
  email_cliente text,
  nome_cliente text,
  criado_em_origem timestamptz,
  canal text,
  origem text,
  codigo_loja text,
  cnpj_loja text,
  veiculo_interesse text,
  tags text[] DEFAULT '{}'::text[],
  lead_maia text,
  lead_pri text,
  status text NOT NULL DEFAULT 'ativo',
  motivo_nao_venda text,
  motivo_orfao text,
  importado_em_evento_ids uuid[] DEFAULT '{}'::uuid[],
  ingestao_job_id uuid REFERENCES public.pool_ingestao_jobs(id) ON DELETE SET NULL,
  snapshot_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pool_clientes_externos_status_check CHECK (status IN ('ativo', 'orfao', 'descartado'))
);

CREATE UNIQUE INDEX idx_pool_clientes_externos_empresa_proposta
  ON public.pool_clientes_externos (empresa_id, codigo_proposta)
  WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX idx_pool_clientes_externos_orfaos
  ON public.pool_clientes_externos (codigo_proposta, codigo_loja)
  WHERE empresa_id IS NULL;

CREATE INDEX idx_pool_clientes_externos_empresa_status ON public.pool_clientes_externos(empresa_id, status);
CREATE INDEX idx_pool_clientes_externos_telefone ON public.pool_clientes_externos(telefone);
CREATE INDEX idx_pool_clientes_externos_codigo_loja ON public.pool_clientes_externos(codigo_loja);
CREATE INDEX idx_pool_clientes_externos_snapshot_date ON public.pool_clientes_externos(snapshot_date DESC);
CREATE INDEX idx_pool_clientes_externos_importado_eventos ON public.pool_clientes_externos USING gin(importado_em_evento_ids);

CREATE TRIGGER set_pool_clientes_externos_updated_at
  BEFORE UPDATE ON public.pool_clientes_externos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pool_clientes_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_ingestao_jobs ENABLE ROW LEVEL SECURITY;

-- Usa a assinatura (uuid, uuid) explicitamente para evitar ambiguidade de overload
CREATE POLICY "pool_clientes_externos_select_by_empresa"
  ON public.pool_clientes_externos
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IS NOT NULL AND public.user_can_access_empresa(empresa_id, auth.uid())
  );

CREATE POLICY "pool_clientes_externos_select_orfaos_admin"
  ON public.pool_clientes_externos
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND tipo_acesso IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

CREATE POLICY "pool_clientes_externos_update_by_empresa"
  ON public.pool_clientes_externos
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id IS NOT NULL AND public.user_can_access_empresa(empresa_id, auth.uid())
  )
  WITH CHECK (
    empresa_id IS NOT NULL AND public.user_can_access_empresa(empresa_id, auth.uid())
  );

CREATE POLICY "pool_ingestao_jobs_select_admin"
  ON public.pool_ingestao_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND tipo_acesso IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );

COMMENT ON TABLE public.pool_clientes_externos IS 'Pool de clientes vindos do Datalake (POST diário). Aguardam importação manual em eventos de prospecção.';
COMMENT ON TABLE public.pool_ingestao_jobs IS 'Registro de cada POST recebido do Datalake para ingestão do pool.';
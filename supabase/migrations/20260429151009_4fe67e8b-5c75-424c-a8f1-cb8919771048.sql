-- Unique para leads vinculados a empresa
CREATE UNIQUE INDEX IF NOT EXISTS pool_clientes_externos_empresa_proposta_uniq
  ON public.pool_clientes_externos (empresa_id, codigo_proposta)
  WHERE empresa_id IS NOT NULL;

-- Unique para leads órfãos (sem empresa resolvida)
CREATE UNIQUE INDEX IF NOT EXISTS pool_clientes_externos_loja_proposta_uniq
  ON public.pool_clientes_externos (codigo_loja, codigo_proposta)
  WHERE empresa_id IS NULL;
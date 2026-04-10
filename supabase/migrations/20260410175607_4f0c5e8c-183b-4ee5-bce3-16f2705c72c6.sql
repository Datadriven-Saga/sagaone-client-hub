CREATE INDEX IF NOT EXISTS idx_contato_quarentena_empresa_canal_impacto ON public.contato_quarentena (empresa_id, canal, ultimo_impacto_at DESC);
CREATE INDEX IF NOT EXISTS idx_contato_quarentena_marca ON public.contato_quarentena (marca);
CREATE INDEX IF NOT EXISTS idx_contato_quarentena_empresa_marca ON public.contato_quarentena (empresa_id, marca);
CREATE INDEX IF NOT EXISTS idx_contato_quarentena_desativado ON public.contato_quarentena (desativado);
CREATE INDEX IF NOT EXISTS idx_contato_quarentena_data_fim_evento ON public.contato_quarentena (data_fim_evento);
CREATE INDEX IF NOT EXISTS idx_contato_quarentena_telefone_normalizado ON public.contato_quarentena (telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_quarentena_config_lookup ON public.quarentena_config (empresa_id, marca, canal);
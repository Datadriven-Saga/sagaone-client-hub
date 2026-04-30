CREATE INDEX IF NOT EXISTS idx_quarentena_marca_impacto
  ON public.contato_quarentena (marca, ultimo_impacto_at DESC);

CREATE INDEX IF NOT EXISTS idx_quarentena_ativo_expira
  ON public.contato_quarentena (expira_em)
  WHERE desativado = false;

CREATE INDEX IF NOT EXISTS idx_quarentena_telefone_prefix
  ON public.contato_quarentena (telefone_normalizado text_pattern_ops);
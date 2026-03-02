
-- Indexes for contatos table (most used in filters)
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_status ON public.contatos (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_created ON public.contatos (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contatos_responsavel_email ON public.contatos (responsavel_email) WHERE responsavel_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contatos_empresa_updated ON public.contatos (empresa_id, updated_at DESC);

-- Index for eventos_prospeccao lookups (heavily used for contato-prospeccao mapping)
CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_prospeccao_contato ON public.eventos_prospeccao (prospeccao_id, contato_id);
CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_contato ON public.eventos_prospeccao (contato_id);

-- Index for prospeccoes by empresa
CREATE INDEX IF NOT EXISTS idx_prospeccoes_empresa ON public.prospeccoes (empresa_id, created_at DESC);


-- Criar tabela de auditoria para prospecções/eventos
CREATE TABLE public.logs_prospeccoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  usuario_id UUID,
  usuario_nome TEXT,
  usuario_email TEXT,
  acao TEXT NOT NULL, -- 'criacao', 'edicao', 'exclusao', 'disparo_ia', 'adicao_contatos'
  dados_anteriores JSONB,
  dados_novos JSONB,
  detalhes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_logs_prospeccoes_prospeccao ON public.logs_prospeccoes(prospeccao_id);
CREATE INDEX idx_logs_prospeccoes_empresa ON public.logs_prospeccoes(empresa_id);
CREATE INDEX idx_logs_prospeccoes_usuario ON public.logs_prospeccoes(usuario_id);
CREATE INDEX idx_logs_prospeccoes_acao ON public.logs_prospeccoes(acao);
CREATE INDEX idx_logs_prospeccoes_created_at ON public.logs_prospeccoes(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.logs_prospeccoes ENABLE ROW LEVEL SECURITY;

-- Política: usuários da empresa podem ver os logs
CREATE POLICY "logs_prospeccoes_empresa_select"
ON public.logs_prospeccoes
FOR SELECT
USING (empresa_id = get_user_active_company(auth.uid()));

-- Política: usuários da empresa podem inserir logs
CREATE POLICY "logs_prospeccoes_empresa_insert"
ON public.logs_prospeccoes
FOR INSERT
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Adicionar comentário na tabela
COMMENT ON TABLE public.logs_prospeccoes IS 'Tabela de auditoria para todas as ações em prospecções/eventos';
COMMENT ON COLUMN public.logs_prospeccoes.acao IS 'Tipo de ação: criacao, edicao, exclusao, disparo_ia, adicao_contatos, remocao_contatos';

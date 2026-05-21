-- 1. Backup completo das anotações antes de qualquer mudança
CREATE TABLE IF NOT EXISTS public.eventos_prospeccao_backup_anotacoes AS
SELECT * FROM public.eventos_prospeccao WHERE tipo_evento = 'Anotação';

-- 2. Nova tabela
CREATE TABLE public.contato_anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  descricao text NOT NULL,
  prospeccao_id uuid REFERENCES public.prospeccoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contato_anotacoes_contato ON public.contato_anotacoes(contato_id, created_at DESC);
CREATE INDEX idx_contato_anotacoes_empresa ON public.contato_anotacoes(empresa_id);
CREATE INDEX idx_contato_anotacoes_prospeccao ON public.contato_anotacoes(prospeccao_id) WHERE prospeccao_id IS NOT NULL;

-- 3. RLS
ALTER TABLE public.contato_anotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contato_anotacoes_select"
ON public.contato_anotacoes FOR SELECT
USING (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
);

CREATE POLICY "contato_anotacoes_insert"
ON public.contato_anotacoes FOR INSERT
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
);

CREATE POLICY "contato_anotacoes_update"
ON public.contato_anotacoes FOR UPDATE
USING (usuario_id = auth.uid());

CREATE POLICY "contato_anotacoes_delete"
ON public.contato_anotacoes FOR DELETE
USING (usuario_id = auth.uid());

-- 4. Migrar dados existentes (sem mapeamento heurístico — prospeccao_id original como metadado)
INSERT INTO public.contato_anotacoes (contato_id, usuario_id, empresa_id, descricao, prospeccao_id, created_at)
SELECT
  ep.contato_id,
  ep.usuario_id,
  p.empresa_id,
  ep.descricao,
  ep.prospeccao_id,
  ep.created_at
FROM public.eventos_prospeccao ep
JOIN public.prospeccoes p ON p.id = ep.prospeccao_id
WHERE ep.tipo_evento = 'Anotação'
  AND ep.usuario_id IS NOT NULL
  AND ep.descricao IS NOT NULL
  AND ep.contato_id IS NOT NULL;
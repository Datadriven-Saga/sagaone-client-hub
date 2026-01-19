-- Adicionar coluna prospeccao_id para vincular visitas a eventos específicos
ALTER TABLE public.recepcao_visitas 
ADD COLUMN IF NOT EXISTS prospeccao_id UUID REFERENCES public.prospeccoes(id);

-- Criar índice para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_recepcao_visitas_prospeccao_telefone 
ON public.recepcao_visitas(prospeccao_id, telefone_cliente);

-- Comentário explicativo
COMMENT ON COLUMN public.recepcao_visitas.prospeccao_id IS 'ID do evento/prospecção para validação de unicidade de check-in';
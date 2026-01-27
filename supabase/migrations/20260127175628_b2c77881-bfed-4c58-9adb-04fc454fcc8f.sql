-- Adicionar coluna status ao cronograma_implantacao
ALTER TABLE public.cronograma_implantacao 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';

-- Limpar todos os cronogramas existentes (conforme solicitado)
DELETE FROM public.cronograma_implantacao;
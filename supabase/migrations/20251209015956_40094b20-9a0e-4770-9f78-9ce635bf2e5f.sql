-- Criar tabela de motivos de não participação
CREATE TABLE public.motivos_nao_participacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.motivos_nao_participacao ENABLE ROW LEVEL SECURITY;

-- Política RLS para usuários da empresa
CREATE POLICY "motivos_nao_participacao_empresa_users_all"
ON public.motivos_nao_participacao
FOR ALL
USING (empresa_id = get_user_active_company(auth.uid()))
WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_motivos_nao_participacao_updated_at
BEFORE UPDATE ON public.motivos_nao_participacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir motivos padrão para todas as empresas existentes
INSERT INTO public.motivos_nao_participacao (empresa_id, descricao, ordem)
SELECT e.id, m.descricao, m.ordem
FROM public.empresas e
CROSS JOIN (
  VALUES 
    ('Apenas pesquisando', 1),
    ('Compra Futura', 2),
    ('Comprou no Particular', 3),
    ('Condições Financeiras do Cliente', 4),
    ('Desistência', 5),
    ('Indisponibilidade no estoque', 6),
    ('Interesse em assinatura', 7),
    ('Interesse em consórcio', 8),
    ('Já comprou com a concorrência', 9),
    ('Já comprou conosco', 10),
    ('Não está em momento de compra', 11),
    ('Não pode comparecer', 12),
    ('Não tem interesse', 13)
) AS m(descricao, ordem);
-- Criar tabela de origens configuráveis por empresa
CREATE TABLE public.origens_lead (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para performance
CREATE INDEX idx_origens_lead_empresa_id ON public.origens_lead(empresa_id);

-- Habilitar RLS
ALTER TABLE public.origens_lead ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários podem ver origens da sua empresa"
ON public.origens_lead
FOR SELECT
USING (
    empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins podem inserir origens"
ON public.origens_lead
FOR INSERT
WITH CHECK (
    empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins podem atualizar origens"
ON public.origens_lead
FOR UPDATE
USING (
    empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins podem deletar origens"
ON public.origens_lead
FOR DELETE
USING (
    empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid()
    )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_origens_lead_updated_at
BEFORE UPDATE ON public.origens_lead
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Popular origens padrão para todas as empresas existentes
INSERT INTO public.origens_lead (empresa_id, nome, ordem)
SELECT 
    e.id,
    origem.nome,
    origem.ordem
FROM public.empresas e
CROSS JOIN (
    VALUES 
        ('Site', 1),
        ('WhatsApp', 2),
        ('Instagram', 3),
        ('Facebook', 4),
        ('Google', 5),
        ('Indicação', 6),
        ('Telefone', 7),
        ('Email', 8),
        ('Outros', 9)
) AS origem(nome, ordem);
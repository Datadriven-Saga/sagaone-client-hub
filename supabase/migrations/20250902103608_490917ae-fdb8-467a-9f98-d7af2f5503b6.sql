-- Criar tabela para logs de movimentação de leads na prospecção
CREATE TABLE public.logs_movimentacao_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  prospeccao_id UUID NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  data_movimentacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_id UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logs_movimentacao_leads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuários podem ver logs da empresa"
ON public.logs_movimentacao_leads 
FOR SELECT 
USING (
  prospeccao_id IN (
    SELECT prospeccoes.id 
    FROM prospeccoes 
    WHERE prospeccoes.empresa_id IN (
      SELECT profiles.empresa_id 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    )
  )
);

CREATE POLICY "Usuários podem inserir logs da empresa"
ON public.logs_movimentacao_leads 
FOR INSERT 
WITH CHECK (
  prospeccao_id IN (
    SELECT prospeccoes.id 
    FROM prospeccoes 
    WHERE prospeccoes.empresa_id IN (
      SELECT profiles.empresa_id 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    )
  )
);

-- Criar índices para performance
CREATE INDEX idx_logs_movimentacao_lead_id ON public.logs_movimentacao_leads(lead_id);
CREATE INDEX idx_logs_movimentacao_prospeccao_id ON public.logs_movimentacao_leads(prospeccao_id);
CREATE INDEX idx_logs_movimentacao_data ON public.logs_movimentacao_leads(data_movimentacao);
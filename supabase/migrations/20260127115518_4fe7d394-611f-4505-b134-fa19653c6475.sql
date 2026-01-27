-- Add new columns to controle_agentes table for enhanced agent management
ALTER TABLE public.controle_agentes 
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS numero_telefone TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Add comment describing the table
COMMENT ON TABLE public.controle_agentes IS 'Tabela de controle de implantação e gerenciamento de agentes IA por loja';

-- Add comments on new columns
COMMENT ON COLUMN public.controle_agentes.descricao IS 'Descrição do que o agente faz e pelo que é responsável';
COMMENT ON COLUMN public.controle_agentes.numero_telefone IS 'Número de telefone do agente';
COMMENT ON COLUMN public.controle_agentes.ativo IS 'Se o agente está ativo ou inativo';
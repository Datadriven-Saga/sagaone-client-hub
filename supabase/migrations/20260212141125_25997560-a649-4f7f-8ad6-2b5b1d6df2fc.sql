
-- Tabela para controlar quarentena de contatos (30 dias sem reimpacto)
CREATE TABLE public.contato_quarentena (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone_normalizado TEXT NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  ultimo_impacto_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prospeccao_id UUID REFERENCES public.prospeccoes(id),
  evento_nome TEXT,
  canal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicatas por telefone+empresa
CREATE UNIQUE INDEX idx_quarentena_telefone_empresa 
  ON public.contato_quarentena(telefone_normalizado, empresa_id);

-- Índice para busca rápida por data de expiração
CREATE INDEX idx_quarentena_ultimo_impacto 
  ON public.contato_quarentena(ultimo_impacto_at);

-- Enable RLS
ALTER TABLE public.contato_quarentena ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view quarantine for their company"
  ON public.contato_quarentena FOR SELECT
  USING (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Users can insert quarantine for their company"
  ON public.contato_quarentena FOR INSERT
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Users can update quarantine for their company"
  ON public.contato_quarentena FOR UPDATE
  USING (empresa_id = get_user_active_company(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_contato_quarentena_updated_at
  BEFORE UPDATE ON public.contato_quarentena
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar quarentena (retorna contatos bloqueados)
CREATE OR REPLACE FUNCTION public.check_quarentena(
  p_telefones TEXT[],
  p_empresa_id UUID
)
RETURNS TABLE(telefone TEXT, em_quarentena BOOLEAN, ultimo_impacto TIMESTAMPTZ, evento TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.telefone,
    CASE 
      WHEN cq.id IS NOT NULL AND cq.ultimo_impacto_at > (now() - INTERVAL '30 days') 
      THEN true 
      ELSE false 
    END AS em_quarentena,
    cq.ultimo_impacto_at AS ultimo_impacto,
    cq.evento_nome AS evento
  FROM unnest(p_telefones) AS t(telefone)
  LEFT JOIN public.contato_quarentena cq 
    ON cq.telefone_normalizado = t.telefone 
    AND cq.empresa_id = p_empresa_id;
END;
$$;

-- Tabela para notificações de importação de base (para CRM)
CREATE TABLE public.notificacoes_importacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  solicitante_id UUID NOT NULL,
  solicitante_nome TEXT NOT NULL,
  base_nome TEXT NOT NULL,
  total_contatos INTEGER DEFAULT 0,
  prospeccao_id UUID REFERENCES public.prospeccoes(id),
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, aprovada, reprovada
  revisado_por UUID,
  revisado_at TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificacoes_importacao ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view notifications for their company"
  ON public.notificacoes_importacao FOR SELECT
  USING (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Users can create notifications for their company"
  ON public.notificacoes_importacao FOR INSERT
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "CRM/Admin can update notifications"
  ON public.notificacoes_importacao FOR UPDATE
  USING (empresa_id = get_user_active_company(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_notificacoes_importacao_updated_at
  BEFORE UPDATE ON public.notificacoes_importacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Tabela para registrar logs de notificações por email
CREATE TABLE public.logs_notificacoes_email (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'evento_criado',
  referencia_id UUID,
  referencia_tipo TEXT DEFAULT 'prospeccao',
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  assunto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  enviado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logs_notificacoes_email ENABLE ROW LEVEL SECURITY;

-- Policies: apenas admins/TI/Master podem ver logs
CREATE POLICY "Admins podem ver logs de notificação"
  ON public.logs_notificacoes_email
  FOR SELECT
  USING (
    get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Master'::tipo_acesso)
    AND empresa_id = get_user_active_company(auth.uid())
  );

-- Edge functions (service role) podem inserir
CREATE POLICY "Service pode inserir logs"
  ON public.logs_notificacoes_email
  FOR INSERT
  WITH CHECK (true);

-- Index para consultas
CREATE INDEX idx_logs_notificacoes_empresa ON public.logs_notificacoes_email(empresa_id, created_at DESC);
CREATE INDEX idx_logs_notificacoes_referencia ON public.logs_notificacoes_email(referencia_id, referencia_tipo);


-- Tabela de logs de disparos (auditoria)
CREATE TABLE public.logs_disparos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  usuario_perfil TEXT NOT NULL,
  prospeccao_id UUID NOT NULL,
  evento_nome TEXT NOT NULL,
  canal TEXT NOT NULL,
  total_contatos INTEGER NOT NULL DEFAULT 0,
  cotacao_dolar NUMERIC(10,4) NOT NULL,
  cotacao_data TIMESTAMP WITH TIME ZONE NOT NULL,
  custo_total_usd NUMERIC(12,4) NOT NULL,
  custo_total_brl NUMERIC(12,4) NOT NULL,
  valor_unitario_usd NUMERIC(10,4) NOT NULL DEFAULT 0.06,
  disparo_id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logs_disparos ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar todos os logs
CREATE POLICY "Admins can view all dispatch logs"
ON public.logs_disparos
FOR SELECT
USING (
  get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'Master'::tipo_acesso, 'TI'::tipo_acesso)
);

-- Usuários autenticados podem inserir logs (ao confirmar disparo)
CREATE POLICY "Authenticated users can insert dispatch logs"
ON public.logs_disparos
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Ninguém pode atualizar ou deletar logs
-- (sem policies de UPDATE/DELETE = bloqueado por RLS)

-- Índices para performance de filtros
CREATE INDEX idx_logs_disparos_created_at ON public.logs_disparos(created_at DESC);
CREATE INDEX idx_logs_disparos_usuario_id ON public.logs_disparos(usuario_id);
CREATE INDEX idx_logs_disparos_prospeccao_id ON public.logs_disparos(prospeccao_id);

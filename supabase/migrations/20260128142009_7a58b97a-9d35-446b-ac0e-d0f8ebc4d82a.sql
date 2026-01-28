-- Create table for training modules/personas
CREATE TABLE public.treinamento_modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treinamento_id UUID NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  persona_nome TEXT,
  persona_cargo TEXT,
  persona_empresa TEXT,
  persona_objetivo TEXT,
  cenario TEXT,
  prompt_ia TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for user training progress
CREATE TABLE public.treinamento_progresso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  treinamento_id UUID NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  modulo_id UUID REFERENCES public.treinamento_modulos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'reprovado')),
  nota NUMERIC,
  tentativas INTEGER DEFAULT 0,
  tempo_gasto_segundos INTEGER DEFAULT 0,
  feedback_ia TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, treinamento_id, modulo_id)
);

-- Create table for mandatory training assignments
CREATE TABLE public.treinamento_obrigatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treinamento_id UUID NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  atribuido_por UUID NOT NULL,
  prazo TIMESTAMP WITH TIME ZONE,
  motivo TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(treinamento_id, user_id)
);

-- Enable RLS
ALTER TABLE public.treinamento_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_obrigatorios ENABLE ROW LEVEL SECURITY;

-- RLS Policies for treinamento_modulos
CREATE POLICY "treinamento_modulos_select" ON public.treinamento_modulos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM treinamentos t 
      WHERE t.id = treinamento_id
    )
  );

CREATE POLICY "treinamento_modulos_admins_ti_manage" ON public.treinamento_modulos
  FOR ALL USING (
    get_current_user_access_type() IN ('Administrador', 'TI')
  );

-- RLS Policies for treinamento_progresso
CREATE POLICY "treinamento_progresso_own" ON public.treinamento_progresso
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "treinamento_progresso_managers_select" ON public.treinamento_progresso
  FOR SELECT USING (
    get_current_user_access_type() IN ('Gerente de Leads', 'Gerente de Loja', 'Diretor')
    AND empresa_id = get_user_active_company(auth.uid())
  );

CREATE POLICY "treinamento_progresso_admins_ti_select" ON public.treinamento_progresso
  FOR SELECT USING (
    get_current_user_access_type() IN ('Administrador', 'TI')
  );

-- RLS Policies for treinamento_obrigatorios
CREATE POLICY "treinamento_obrigatorios_own_select" ON public.treinamento_obrigatorios
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "treinamento_obrigatorios_managers_manage" ON public.treinamento_obrigatorios
  FOR ALL USING (
    get_current_user_access_type() IN ('Gerente de Leads', 'Gerente de Loja', 'Diretor')
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() IN ('Gerente de Leads', 'Gerente de Loja', 'Diretor')
    AND empresa_id = get_user_active_company(auth.uid())
  );

CREATE POLICY "treinamento_obrigatorios_admins_ti_manage" ON public.treinamento_obrigatorios
  FOR ALL USING (
    get_current_user_access_type() IN ('Administrador', 'TI')
  );

-- Create indexes for performance
CREATE INDEX idx_treinamento_progresso_user ON public.treinamento_progresso(user_id);
CREATE INDEX idx_treinamento_progresso_treinamento ON public.treinamento_progresso(treinamento_id);
CREATE INDEX idx_treinamento_obrigatorios_user ON public.treinamento_obrigatorios(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_treinamento_modulos_updated_at
  BEFORE UPDATE ON public.treinamento_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treinamento_progresso_updated_at
  BEFORE UPDATE ON public.treinamento_progresso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
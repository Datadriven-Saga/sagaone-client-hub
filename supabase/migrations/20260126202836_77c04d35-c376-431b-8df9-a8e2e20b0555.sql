-- Criar tabela de controle de implantação de agentes (separada da tabela agentes_ia)
CREATE TABLE IF NOT EXISTS public.controle_agentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_agente TEXT NOT NULL,
  tipo_agente TEXT NOT NULL, -- Ex: Prosc. Acessorios, Busca e Resgate, Entrega, Seguros, etc.
  marca TEXT NOT NULL,
  uf TEXT NOT NULL,
  loja TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  responsavel TEXT,
  implantador TEXT,
  telefone_toca TEXT,
  cronograma TEXT, -- Data prevista ou status
  status TEXT, -- ok, IMPLANTADA, bloqueado, erro, etc.
  chamado TEXT,
  observacoes TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_controle_agentes_nome ON public.controle_agentes(nome_agente);
CREATE INDEX IF NOT EXISTS idx_controle_agentes_marca ON public.controle_agentes(marca);
CREATE INDEX IF NOT EXISTS idx_controle_agentes_uf ON public.controle_agentes(uf);
CREATE INDEX IF NOT EXISTS idx_controle_agentes_loja ON public.controle_agentes(loja);
CREATE INDEX IF NOT EXISTS idx_controle_agentes_status ON public.controle_agentes(status);
CREATE INDEX IF NOT EXISTS idx_controle_agentes_cnpj ON public.controle_agentes(cnpj);

-- Habilitar RLS
ALTER TABLE public.controle_agentes ENABLE ROW LEVEL SECURITY;

-- Política para admins e TI terem acesso total
CREATE POLICY "controle_agentes_admins_ti_full_access"
ON public.controle_agentes
FOR ALL
USING (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
)
WITH CHECK (
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

-- Política para usuários verem dados de sua empresa
CREATE POLICY "controle_agentes_users_select"
ON public.controle_agentes
FOR SELECT
USING (
  empresa_id = get_user_active_company(auth.uid()) OR
  get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_controle_agentes_updated_at
  BEFORE UPDATE ON public.controle_agentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
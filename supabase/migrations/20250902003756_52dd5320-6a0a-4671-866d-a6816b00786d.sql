-- Criar enums adicionais
CREATE TYPE public.status_lead AS ENUM ('Novo', 'Em Contato', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Perdido');
CREATE TYPE public.tipo_notificacao AS ENUM ('Sistema', 'WhatsApp', 'Email', 'SMS', 'Push');
CREATE TYPE public.status_notificacao AS ENUM ('Enviada', 'Lida', 'Pendente', 'Erro');
CREATE TYPE public.origem_lead AS ENUM ('Site', 'WhatsApp', 'Instagram', 'Facebook', 'Google', 'Indicação', 'Telefone', 'Email', 'Outros');
CREATE TYPE public.status_persona AS ENUM ('Ativa', 'Inativa', 'Em Desenvolvimento');
CREATE TYPE public.tipo_evento_prospeccao AS ENUM ('Contato Inicial', 'Follow-up', 'Proposta Enviada', 'Reunião Agendada', 'Negociação', 'Fechamento');
CREATE TYPE public.status_meta AS ENUM ('Ativa', 'Pausada', 'Concluída', 'Cancelada');
CREATE TYPE public.tipo_meta AS ENUM ('Vendas', 'Leads', 'Conversão', 'Atendimento');
CREATE TYPE public.tipo_gatilho AS ENUM ('Temporal', 'Evento', 'Condicional');
CREATE TYPE public.status_gatilho AS ENUM ('Ativo', 'Inativo', 'Pausado');

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  data_nascimento DATE,
  observacoes TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de leads
CREATE TABLE public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  origem origem_lead DEFAULT 'Outros',
  status status_lead DEFAULT 'Novo',
  valor_potencial DECIMAL(10,2),
  observacoes TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  responsavel_id UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de tipos de notificação
CREATE TABLE public.tipos_notificacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  template_padrao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de notificações
CREATE TABLE public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo tipo_notificacao DEFAULT 'Sistema',
  status status_notificacao DEFAULT 'Pendente',
  destinatario_id UUID REFERENCES public.profiles(id),
  remetente_id UUID REFERENCES public.profiles(id),
  tipo_notificacao_id UUID REFERENCES public.tipos_notificacao(id),
  lead_id UUID REFERENCES public.leads(id),
  cliente_id UUID REFERENCES public.clientes(id),
  data_envio TIMESTAMP WITH TIME ZONE,
  data_leitura TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de personas de IA
CREATE TABLE public.personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  personalidade TEXT,
  instrucoes_sistema TEXT,
  exemplo_conversas JSONB,
  status status_persona DEFAULT 'Em Desenvolvimento',
  empresa_id UUID REFERENCES public.empresas(id),
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de prospecção
CREATE TABLE public.prospeccoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_fim DATE,
  meta_leads INTEGER,
  leads_gerados INTEGER DEFAULT 0,
  responsavel_id UUID REFERENCES public.profiles(id),
  persona_id UUID REFERENCES public.personas(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de eventos de prospecção
CREATE TABLE public.eventos_prospeccao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  tipo_evento tipo_evento_prospeccao,
  descricao TEXT,
  data_evento TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resultado TEXT,
  proximo_contato TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela da loja (produtos/serviços)
CREATE TABLE public.produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2),
  categoria TEXT,
  ativo BOOLEAN DEFAULT true,
  estoque INTEGER DEFAULT 0,
  imagem_url TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de vendas/pedidos
CREATE TABLE public.vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  vendedor_id UUID REFERENCES public.profiles(id),
  valor_total DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) DEFAULT 0,
  valor_final DECIMAL(10,2) NOT NULL,
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT now(),
  observacoes TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de itens da venda
CREATE TABLE public.itens_venda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de metas
CREATE TABLE public.metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_meta,
  valor_meta DECIMAL(10,2),
  valor_atual DECIMAL(10,2) DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  status status_meta DEFAULT 'Ativa',
  usuario_id UUID REFERENCES public.profiles(id),
  equipe_id TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de relatórios
CREATE TABLE public.relatorios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  parametros JSONB,
  dados_relatorio JSONB,
  data_geracao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  gerado_por UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de treinamentos
CREATE TABLE public.treinamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  conteudo TEXT,
  duracao_minutos INTEGER,
  categoria TEXT,
  nivel TEXT,
  ativo BOOLEAN DEFAULT true,
  instrutor_id UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de participações em treinamentos
CREATE TABLE public.participacoes_treinamento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  treinamento_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  participante_id UUID REFERENCES public.profiles(id),
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  progresso INTEGER DEFAULT 0,
  nota DECIMAL(3,1),
  certificado_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de gatilhos
CREATE TABLE public.gatilhos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_gatilho,
  condicoes JSONB,
  acoes JSONB,
  status status_gatilho DEFAULT 'Ativo',
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  proxima_execucao TIMESTAMP WITH TIME ZONE,
  criado_por UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_prospeccao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participacoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatilhos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clientes
CREATE POLICY "Usuários podem ver clientes da empresa" ON public.clientes
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem gerenciar clientes da empresa" ON public.clientes
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para leads
CREATE POLICY "Usuários podem ver leads da empresa" ON public.leads
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem gerenciar leads da empresa" ON public.leads
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para notificações
CREATE POLICY "Usuários podem ver suas notificações" ON public.notificacoes
  FOR SELECT USING (destinatario_id = auth.uid());

CREATE POLICY "Usuários podem gerenciar notificações enviadas" ON public.notificacoes
  FOR ALL USING (remetente_id = auth.uid());

-- Políticas RLS para personas
CREATE POLICY "Usuários podem ver personas da empresa" ON public.personas
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem gerenciar personas da empresa" ON public.personas
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas similares para outras tabelas
CREATE POLICY "Usuários podem ver dados da empresa" ON public.prospeccoes
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.prospeccoes
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.produtos
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.produtos
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.vendas
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.vendas
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.metas
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.metas
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.relatorios
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.relatorios
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.treinamentos
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.treinamentos
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários podem ver dados da empresa" ON public.gatilhos
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários podem gerenciar dados da empresa" ON public.gatilhos
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

-- Políticas para tabelas relacionais
CREATE POLICY "Usuários podem ver eventos de prospecção" ON public.eventos_prospeccao
  FOR SELECT USING (
    prospeccao_id IN (
      SELECT id FROM public.prospeccoes 
      WHERE empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Usuários podem ver itens de venda" ON public.itens_venda
  FOR SELECT USING (
    venda_id IN (
      SELECT id FROM public.vendas 
      WHERE empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Usuários podem ver participações em treinamento" ON public.participacoes_treinamento
  FOR SELECT USING (participante_id = auth.uid());

-- Triggers para updated_at
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON public.personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospeccoes_updated_at
  BEFORE UPDATE ON public.prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treinamentos_updated_at
  BEFORE UPDATE ON public.treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gatilhos_updated_at
  BEFORE UPDATE ON public.gatilhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
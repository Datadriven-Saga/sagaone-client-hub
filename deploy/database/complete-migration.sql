-- ==========================================
-- MIGRAÇÃO COMPLETA DO BANCO DE DADOS
-- Sistema de CRM e Prospecção com Agentes IA
-- ==========================================

-- Criar tipos personalizados
CREATE TYPE IF NOT EXISTS tipo_acesso AS ENUM (
  'Administrador',
  'TI',
  'Diretor',
  'Gerente de Leads',
  'Gerente de Loja',
  'SDR',
  'Closer',
  'Atendimento',
  'Suporte'
);

CREATE TYPE IF NOT EXISTS status_usuario AS ENUM (
  'Ativo',
  'Inativo',
  'Suspenso'
);

CREATE TYPE IF NOT EXISTS status_lead AS ENUM (
  'Novo',
  'Qualificado',
  'Em Contato',
  'Em Negociação',
  'Fechado',
  'Perdido'
);

CREATE TYPE IF NOT EXISTS origem_lead AS ENUM (
  'Site',
  'Google Ads',
  'Facebook',
  'Instagram', 
  'WhatsApp',
  'Indicação',
  'Telefone',
  'Email',
  'LinkedIn',
  'Outros'
);

CREATE TYPE IF NOT EXISTS tipo_evento AS ENUM (
  'Ligação',
  'WhatsApp',
  'Email',
  'Reunião',
  'Visita',
  'Proposta'
);

CREATE TYPE IF NOT EXISTS tipo_gatilho AS ENUM (
  'Temporal',
  'Evento',
  'Condicional'
);

CREATE TYPE IF NOT EXISTS status_gatilho AS ENUM (
  'Ativo',
  'Inativo',
  'Pausado'
);

CREATE TYPE IF NOT EXISTS dia_semana AS ENUM (
  'Segunda',
  'Terça', 
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo'
);

CREATE TYPE IF NOT EXISTS status_notificacao AS ENUM (
  'Pendente',
  'Lida',
  'Arquivada'
);

CREATE TYPE IF NOT EXISTS tipo_notificacao AS ENUM (
  'Sistema',
  'Email',
  'WhatsApp',
  'Push'
);

CREATE TYPE IF NOT EXISTS status_persona AS ENUM (
  'Em Desenvolvimento',
  'Ativa',
  'Pausada',
  'Arquivada'
);

CREATE TYPE IF NOT EXISTS tipo_meta AS ENUM (
  'Vendas',
  'Leads',
  'Contatos',
  'Conversão'
);

CREATE TYPE IF NOT EXISTS status_meta AS ENUM (
  'Ativa',
  'Pausada', 
  'Concluída',
  'Cancelada'
);

-- ==========================================
-- TABELAS PRINCIPAIS
-- ==========================================

-- Tabela de empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  marca TEXT,
  uf TEXT,
  crm_id TEXT,
  logomarca_url TEXT,
  responsavel_legal_nome TEXT,
  responsavel_legal_email TEXT,
  responsavel_legal_telefone TEXT,
  responsavel_legal_cpf TEXT,
  horario_funcionamento TEXT,
  grupo_empresarial TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  celular TEXT,
  cpf TEXT,
  departamento TEXT,
  foto_url TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  gestor_imediato UUID REFERENCES public.profiles(id),
  tipo_acesso tipo_acesso DEFAULT 'SDR',
  status status_usuario DEFAULT 'Ativo',
  notificacao_email BOOLEAN DEFAULT true,
  notificacao_whatsapp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de associação usuário-empresa
CREATE TABLE IF NOT EXISTS public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  is_ativa BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Tabela de agentes IA
CREATE TABLE IF NOT EXISTS public.agentes_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  foto_url TEXT,
  persona TEXT,
  cerebro TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_por UUID REFERENCES public.profiles(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de cadências dos agentes
CREATE TABLE IF NOT EXISTS public.agente_cadencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id),
  gatilho_cadencia TEXT NOT NULL DEFAULT 'inatividade_cliente',
  quantidade_etapas INTEGER NOT NULL DEFAULT 4,
  delay_inicial_minutos INTEGER NOT NULL DEFAULT 0,
  intervalo_etapas_minutos INTEGER NOT NULL DEFAULT 60,
  horario_inicio TIME NOT NULL DEFAULT '09:00:00',
  horario_fim TIME NOT NULL DEFAULT '18:00:00',
  dias_semana JSONB NOT NULL DEFAULT '["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de followups dos agentes
CREATE TABLE IF NOT EXISTS public.agente_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  condicoes JSONB,
  acoes JSONB,
  webhook_url TEXT NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_por UUID REFERENCES public.profiles(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de integrações dos agentes
CREATE TABLE IF NOT EXISTS public.agente_integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id),
  evolution_id TEXT,
  webhook_url TEXT,
  webhook_metodo TEXT NOT NULL DEFAULT 'POST',
  banco_dados_ia TEXT,
  tabela_historico_ia TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de performance dos agentes
CREATE TABLE IF NOT EXISTS public.agente_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id),
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  cadencias_executadas INTEGER NOT NULL DEFAULT 0,
  followups_executados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de personas
CREATE TABLE IF NOT EXISTS public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  personalidade TEXT,
  instrucoes_sistema TEXT,
  exemplo_conversas JSONB,
  status status_persona DEFAULT 'Em Desenvolvimento',
  empresa_id UUID REFERENCES public.empresas(id),
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de prospecções
CREATE TABLE IF NOT EXISTS public.prospeccoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  canal TEXT NOT NULL DEFAULT 'Whatsapp',
  data_inicio DATE,
  data_fim DATE,
  meta_leads INTEGER,
  leads_gerados INTEGER DEFAULT 0,
  objetivo_vendas TEXT,
  local_evento TEXT,
  condicoes_especiais TEXT,
  imagem_divulgacao_url TEXT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  responsavel_id UUID REFERENCES public.profiles(id),
  persona_id UUID REFERENCES public.personas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de contatos
CREATE TABLE IF NOT EXISTS public.contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  status status_lead DEFAULT 'Novo',
  origem origem_lead DEFAULT 'Outros',
  valor_potencial NUMERIC,
  observacoes TEXT,
  responsavel_email TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de eventos de prospecção
CREATE TABLE IF NOT EXISTS public.eventos_prospeccao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento tipo_evento,
  descricao TEXT,
  data_evento TIMESTAMPTZ DEFAULT now(),
  proximo_contato TIMESTAMPTZ,
  resultado TEXT,
  observacoes TEXT,
  contato_id UUID REFERENCES public.contatos(id),
  prospeccao_id UUID REFERENCES public.prospeccoes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de movimentação de contatos
CREATE TABLE IF NOT EXISTS public.logs_movimentacao_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id UUID NOT NULL REFERENCES public.contatos(id),
  prospeccao_id UUID NOT NULL REFERENCES public.prospeccoes(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacoes TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de gatilhos
CREATE TABLE IF NOT EXISTS public.gatilhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_gatilho,
  condicoes JSONB,
  acoes JSONB,
  status status_gatilho DEFAULT 'Ativo',
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  empresa_id UUID REFERENCES public.empresas(id),
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de horários de trabalho
CREATE TABLE IF NOT EXISTS public.horarios_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  dia_semana dia_semana NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  preco NUMERIC,
  estoque INTEGER DEFAULT 0,
  imagem_url TEXT,
  ativo BOOLEAN DEFAULT true,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido TEXT NOT NULL,
  data_venda TIMESTAMPTZ DEFAULT now(),
  valor_total NUMERIC NOT NULL,
  desconto NUMERIC DEFAULT 0,
  valor_final NUMERIC NOT NULL,
  observacoes TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  vendedor_id UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de itens de venda
CREATE TABLE IF NOT EXISTS public.itens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES public.vendas(id),
  produto_id UUID REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de tipos de notificação
CREATE TABLE IF NOT EXISTS public.tipos_notificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  template_padrao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo tipo_notificacao DEFAULT 'Sistema',
  status status_notificacao DEFAULT 'Pendente',
  data_envio TIMESTAMPTZ,
  data_leitura TIMESTAMPTZ,
  remetente_id UUID REFERENCES public.profiles(id),
  destinatario_id UUID REFERENCES public.profiles(id),
  cliente_id UUID REFERENCES public.clientes(id),
  contato_id UUID REFERENCES public.contatos(id),
  tipo_notificacao_id UUID REFERENCES public.tipos_notificacao(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de metas
CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_meta,
  valor_meta NUMERIC,
  valor_atual NUMERIC DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  status status_meta DEFAULT 'Ativa',
  usuario_id UUID REFERENCES public.profiles(id),
  equipe_id TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de treinamentos
CREATE TABLE IF NOT EXISTS public.treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  conteudo TEXT,
  categoria TEXT,
  nivel TEXT,
  duracao_minutos INTEGER,
  instrutor_id UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de participações em treinamento
CREATE TABLE IF NOT EXISTS public.participacoes_treinamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID REFERENCES public.treinamentos(id),
  participante_id UUID REFERENCES public.profiles(id),
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  progresso INTEGER DEFAULT 0,
  nota NUMERIC,
  certificado_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de relatórios
CREATE TABLE IF NOT EXISTS public.relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  parametros JSONB,
  dados_relatorio JSONB,
  data_geracao TIMESTAMPTZ DEFAULT now(),
  gerado_por UUID REFERENCES public.profiles(id),
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- TRIGGERS E FUNÇÕES
-- ==========================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para lidar com novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para sincronizar contato para cliente
CREATE OR REPLACE FUNCTION public.sync_contato_to_cliente()
RETURNS TRIGGER AS $$
DECLARE
  existing_cliente_id UUID;
BEGIN
  -- Verificar se já existe um cliente com o mesmo nome e telefone na mesma empresa
  SELECT id INTO existing_cliente_id
  FROM public.clientes
  WHERE nome = NEW.nome 
    AND telefone = NEW.telefone 
    AND empresa_id = NEW.empresa_id
  LIMIT 1;

  -- Se não existe, criar um novo cliente
  IF existing_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      nome,
      telefone,
      email,
      empresa_id,
      user_id,
      observacoes,
      created_at,
      updated_at
    )
    VALUES (
      NEW.nome,
      NEW.telefone,
      NEW.email,
      NEW.empresa_id,
      auth.uid(),
      COALESCE(NEW.observacoes, 'Cliente criado automaticamente via prospecção'),
      NOW(),
      NOW()
    )
    RETURNING id INTO existing_cliente_id;
  END IF;

  -- Atualizar o contato com o cliente_id
  NEW.cliente_id = existing_cliente_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para definir empresa_id na inserção
CREATE OR REPLACE FUNCTION public.set_empresa_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Se empresa_id não foi definido, pegar da empresa ativa do usuário
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := get_user_active_company(auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers para updated_at
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_empresas_updated_at
  BEFORE UPDATE ON public.user_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para novos usuários
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger para sincronizar contatos com clientes
CREATE TRIGGER sync_contatos_to_clientes
  BEFORE INSERT ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contato_to_cliente();

-- Triggers para definir empresa_id
CREATE TRIGGER set_empresa_id_clientes
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_empresa_id_produtos
  BEFORE INSERT ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

CREATE TRIGGER set_empresa_id_prospeccoes
  BEFORE INSERT ON public.prospeccoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_on_insert();

-- ==========================================
-- COMENTÁRIO FINAL
-- ==========================================

COMMENT ON DATABASE postgres IS 'Sistema completo de CRM e Prospecção com Agentes IA - Deploy v1.0.0';
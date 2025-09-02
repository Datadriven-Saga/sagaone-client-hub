-- Criar enum para tipos de acesso
CREATE TYPE public.tipo_acesso AS ENUM (
  'SDR',
  'Gerente de Leads', 
  'Vendedor',
  'Gerente de Loja',
  'Busca',
  'Diretor', 
  'Outros',
  'TI',
  'Administrador'
);

-- Criar enum para status do usuário
CREATE TYPE public.status_usuario AS ENUM ('Ativo', 'Inativo', 'Suspenso');

-- Criar enum para dias da semana
CREATE TYPE public.dia_semana AS ENUM ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo');

-- Tabela de empresas
CREATE TABLE public.empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  grupo_empresarial TEXT,
  endereco TEXT,
  email TEXT,
  site TEXT,
  horario_funcionamento TEXT,
  responsavel_legal_nome TEXT,
  responsavel_legal_cpf TEXT,
  responsavel_legal_telefone TEXT,
  responsavel_legal_email TEXT,
  logomarca_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  cpf TEXT UNIQUE,
  celular TEXT,
  status status_usuario DEFAULT 'Ativo',
  tipo_acesso tipo_acesso DEFAULT 'SDR',
  departamento TEXT,
  gestor_imediato UUID REFERENCES public.profiles(id),
  foto_url TEXT,
  notificacao_whatsapp BOOLEAN DEFAULT false,
  notificacao_email BOOLEAN DEFAULT true,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de horários de trabalho
CREATE TABLE public.horarios_trabalho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia_semana dia_semana NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_trabalho ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para empresas
CREATE POLICY "Administradores podem ver todas as empresas" ON public.empresas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND tipo_acesso = 'Administrador'
    )
  );

CREATE POLICY "Administradores podem gerenciar empresas" ON public.empresas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND tipo_acesso = 'Administrador'
    )
  );

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Administradores podem ver todos os perfis" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND tipo_acesso = 'Administrador'
    )
  );

CREATE POLICY "Administradores podem gerenciar perfis" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND tipo_acesso = 'Administrador'
    )
  );

-- Políticas RLS para horários de trabalho
CREATE POLICY "Usuários podem ver seus horários" ON public.horarios_trabalho
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Administradores podem gerenciar horários" ON public.horarios_trabalho
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND tipo_acesso = 'Administrador'
    )
  );

-- Função para criar perfil automaticamente
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
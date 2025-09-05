-- ==========================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- Sistema de CRM e Prospecção com Agentes IA
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_cadencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_prospeccao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_movimentacao_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatilhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participacoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- FUNÇÕES AUXILIARES
-- ==========================================

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND tipo_acesso = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para obter empresa ativa do usuário
CREATE OR REPLACE FUNCTION public.get_user_active_company(user_id_param UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT ue.empresa_id 
      FROM public.user_empresas ue
      WHERE ue.user_id = user_id_param AND ue.is_ativa = true
      LIMIT 1
    ),
    (
      SELECT p.empresa_id 
      FROM public.profiles p 
      WHERE p.id = user_id_param
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para obter tipo de acesso do usuário
CREATE OR REPLACE FUNCTION public.get_current_user_access_type()
RETURNS tipo_acesso AS $$
BEGIN
  RETURN (
    SELECT tipo_acesso 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para verificar se usuário pode gerenciar outros usuários
CREATE OR REPLACE FUNCTION public.can_manage_users(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = user_id
    AND tipo_acesso = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- POLÍTICAS PARA EMPRESAS
-- ==========================================

-- Admins podem fazer tudo
CREATE POLICY "empresas_admin_full_access" ON public.empresas
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Usuários podem apenas visualizar empresas onde têm acesso
CREATE POLICY "empresas_users_readonly" ON public.empresas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_empresas ue
      JOIN public.profiles p ON ue.user_id = p.id
      WHERE ue.user_id = auth.uid() 
      AND ue.empresa_id = empresas.id
    )
  );

-- ==========================================
-- POLÍTICAS PARA PROFILES
-- ==========================================

-- Usuários podem acessar seu próprio perfil
CREATE POLICY "profiles_own_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins podem fazer tudo
CREATE POLICY "profiles_admin_full_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Permitir inserção de novos usuários pelo sistema
CREATE POLICY "profiles_system_insert_new_users" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==========================================
-- POLÍTICAS PARA USER_EMPRESAS
-- ==========================================

-- Usuários podem ver suas próprias empresas
CREATE POLICY "user_empresas_users_view_own" ON public.user_empresas
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuários podem atualizar empresa ativa
CREATE POLICY "user_empresas_users_update_active" ON public.user_empresas
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins podem gerenciar tudo
CREATE POLICY "user_empresas_admins_manage" ON public.user_empresas
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ==========================================
-- POLÍTICAS PARA AGENTES IA
-- ==========================================

-- Apenas admins e TI podem gerenciar agentes
CREATE POLICY "agentes_ia_admins_ti_only" ON public.agentes_ia
  FOR ALL
  TO authenticated
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

-- Políticas similares para tabelas relacionadas aos agentes
CREATE POLICY "agente_cadencias_admins_ti_only" ON public.agente_cadencias
  FOR ALL
  TO authenticated
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

CREATE POLICY "agente_followups_admins_ti_only" ON public.agente_followups
  FOR ALL
  TO authenticated
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

CREATE POLICY "agente_integracoes_admins_ti_only" ON public.agente_integracoes
  FOR ALL
  TO authenticated
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

CREATE POLICY "agente_performance_admins_ti_only" ON public.agente_performance
  FOR ALL
  TO authenticated
  USING (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    get_current_user_access_type() = ANY(ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso])
    AND empresa_id = get_user_active_company(auth.uid())
  );

-- ==========================================
-- POLÍTICAS PARA DADOS DA EMPRESA
-- ==========================================

-- Política padrão para tabelas com empresa_id
CREATE POLICY "prospeccoes_empresa_users_all" ON public.prospeccoes
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "clientes_empresa_users_all" ON public.clientes
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "contatos_empresa_users_all" ON public.contatos
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "personas_company_users" ON public.personas
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "gatilhos_company_users" ON public.gatilhos
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "produtos_company_users" ON public.produtos
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "metas_company_users" ON public.metas
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "treinamentos_company_users" ON public.treinamentos
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "relatorios_company_users" ON public.relatorios
  FOR ALL
  TO authenticated
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));

-- ==========================================
-- POLÍTICAS PARA EVENTOS E LOGS
-- ==========================================

-- Eventos de prospecção - baseados no contato
CREATE POLICY "eventos_prospeccao_empresa_users_all" ON public.eventos_prospeccao
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contatos c
      WHERE c.id = eventos_prospeccao.contato_id
      AND c.empresa_id = get_user_active_company(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contatos c
      WHERE c.id = eventos_prospeccao.contato_id
      AND c.empresa_id = get_user_active_company(auth.uid())
    )
  );

-- Logs de movimentação - baseados no contato
CREATE POLICY "logs_movimentacao_contatos_empresa_users_all" ON public.logs_movimentacao_contatos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contatos c
      WHERE c.id = logs_movimentacao_contatos.contato_id
      AND c.empresa_id = get_user_active_company(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contatos c
      WHERE c.id = logs_movimentacao_contatos.contato_id
      AND c.empresa_id = get_user_active_company(auth.uid())
    )
  );

-- ==========================================
-- POLÍTICAS PARA VENDAS
-- ==========================================

-- Admins e gerentes podem ver/editar todas as vendas da empresa
CREATE POLICY "vendas_admins_same_company_full" ON public.vendas
  FOR ALL
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    AND get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  )
  WITH CHECK (
    empresa_id = get_user_active_company(auth.uid())
    AND get_current_user_access_type() = ANY(ARRAY[
      'Administrador'::tipo_acesso, 
      'TI'::tipo_acesso, 
      'Diretor'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso
    ])
  );

-- Usuários podem ver apenas suas próprias vendas
CREATE POLICY "vendas_users_own_sales_readonly" ON public.vendas
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    AND vendedor_id = auth.uid()
  );

-- ==========================================
-- POLÍTICAS PARA ITENS DE VENDA
-- ==========================================

-- Baseado na venda associada
CREATE POLICY "itens_venda_company_users" ON public.itens_venda
  FOR ALL
  TO authenticated
  USING (
    venda_id IN (
      SELECT id
      FROM public.vendas
      WHERE empresa_id = get_user_active_company(auth.uid())
    )
  )
  WITH CHECK (
    venda_id IN (
      SELECT id
      FROM public.vendas
      WHERE empresa_id = get_user_active_company(auth.uid())
    )
  );

-- ==========================================
-- POLÍTICAS PARA NOTIFICAÇÕES
-- ==========================================

-- Usuários podem ver notificações recebidas
CREATE POLICY "notificacoes_users_received" ON public.notificacoes
  FOR SELECT
  TO authenticated
  USING (destinatario_id = auth.uid());

-- Usuários podem gerenciar notificações enviadas
CREATE POLICY "notificacoes_users_sent" ON public.notificacoes
  FOR ALL
  TO authenticated
  USING (remetente_id = auth.uid());

-- ==========================================
-- POLÍTICAS PARA TIPOS DE NOTIFICAÇÃO
-- ==========================================

-- Apenas admins podem gerenciar tipos de notificação
CREATE POLICY "tipos_notificacao_admins_only" ON public.tipos_notificacao
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ==========================================
-- POLÍTICAS PARA HORÁRIOS DE TRABALHO
-- ==========================================

-- Usuários podem ver seus próprios horários
CREATE POLICY "horarios_users_view_own" ON public.horarios_trabalho
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins podem gerenciar todos os horários
CREATE POLICY "horarios_admins_manage" ON public.horarios_trabalho
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ==========================================
-- POLÍTICAS PARA PARTICIPAÇÕES EM TREINAMENTO
-- ==========================================

-- Usuários podem ver suas próprias participações
CREATE POLICY "participacoes_treinamento_users_view" ON public.participacoes_treinamento
  FOR SELECT
  TO authenticated
  USING (participante_id = auth.uid());

-- ==========================================
-- TRIGGERS PARA AUDITORIA E SEGURANÇA
-- ==========================================

-- Função para prevenir escalação de privilégios
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current user's access type
  DECLARE
    current_user_access tipo_acesso;
  BEGIN
    SELECT tipo_acesso INTO current_user_access 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Only check restrictions for non-admins and when not creating new users
    IF current_user_access != 'Administrador'::tipo_acesso AND OLD IS NOT NULL THEN
      -- Prevent changes to sensitive fields for non-admins
      IF OLD.tipo_acesso IS DISTINCT FROM NEW.tipo_acesso THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar tipo de acesso';
      END IF;
      
      IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar empresa associada';
      END IF;
      
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar status do usuário';
      END IF;
    END IF;
    
    RETURN NEW;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      -- If user doesn't have a profile yet or during user creation, allow it
      RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para prevenir "pulos" entre empresas
CREATE OR REPLACE FUNCTION public.prevent_company_hopping()
RETURNS TRIGGER AS $$
BEGIN
  -- Only admins can modify user_id and empresa_id
  IF NOT is_admin() THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar associação de usuário';
    END IF;
    
    IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar associação de empresa';
    END IF;
    
    -- Non-admins can only change is_ativa for their own records
    IF NEW.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Usuários só podem alterar suas próprias empresas ativas';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers de segurança
CREATE TRIGGER prevent_privilege_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation_profiles();

CREATE TRIGGER prevent_company_hopping_trigger
  BEFORE UPDATE ON public.user_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_company_hopping();

-- ==========================================
-- COMENTÁRIO FINAL
-- ==========================================

COMMENT ON SCHEMA public IS 'Políticas RLS configuradas para isolamento multi-empresa e controle de acesso baseado em perfis';
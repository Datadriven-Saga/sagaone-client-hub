
-- Create the unified system_feature_flags table
CREATE TABLE public.system_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  flag_label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Geral',
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_feature_flags ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admins can read feature flags"
ON public.system_feature_flags FOR SELECT TO authenticated
USING (public.get_current_user_access_type() IN ('Administrador', 'Master', 'TI'));

-- Admin-only update
CREATE POLICY "Admins can update feature flags"
ON public.system_feature_flags FOR UPDATE TO authenticated
USING (public.get_current_user_access_type() IN ('Administrador', 'Master'))
WITH CHECK (public.get_current_user_access_type() IN ('Administrador', 'Master'));

-- Admin-only insert
CREATE POLICY "Admins can insert feature flags"
ON public.system_feature_flags FOR INSERT TO authenticated
WITH CHECK (public.get_current_user_access_type() IN ('Administrador', 'Master'));

-- Admin-only delete
CREATE POLICY "Admins can delete feature flags"
ON public.system_feature_flags FOR DELETE TO authenticated
USING (public.get_current_user_access_type() IN ('Administrador', 'Master'));

-- Also allow service role to read for edge functions (via RPC)
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.system_feature_flags WHERE flag_key = p_flag_key),
    false
  );
$$;

-- Migrate existing MFA flags
INSERT INTO public.system_feature_flags (flag_key, flag_label, description, category, is_enabled, updated_at, updated_by)
SELECT DISTINCT ON (flag_key)
  flag_key,
  flag_label,
  'Funcionalidade migrada do MFA',
  'Segurança',
  enabled,
  updated_at,
  updated_by
FROM public.mfa_feature_flags
ORDER BY flag_key, updated_at DESC;

-- Add system-wide feature flags covering all modules
INSERT INTO public.system_feature_flags (flag_key, flag_label, description, category, is_enabled) VALUES
  ('quarentena_marca_ativa', 'Quarentena por Marca', 'Bloqueio de 30 dias por Marca após o fim da campanha. Leads impactados ficam em quarentena automática.', 'Importação', true),
  ('importacao_csv', 'Importação de CSV', 'Permite importar leads via arquivo CSV na prospecção.', 'Importação', true),
  ('disparo_whatsapp', 'Disparo WhatsApp', 'Habilita o disparo de mensagens via WhatsApp nos eventos.', 'Comunicação', true),
  ('disparo_ligacao', 'Disparo Ligação IA', 'Habilita o disparo de ligações via IA (Vapi/Twilio).', 'Comunicação', true),
  ('notificacao_email_crm', 'Notificação Email CRM', 'Envia e-mails de notificação ao CRM quando eventos são criados.', 'Comunicação', true),
  ('auto_atribuicao_leads', 'Auto-atribuição de Leads', 'Vendedores podem puxar leads automaticamente (até 30 pendentes).', 'Prospecção', true),
  ('kanban_board', 'Kanban de Leads', 'Visualização Kanban para gestão de contatos na prospecção.', 'Prospecção', true),
  ('academy_simulacoes', 'Simulações Academy', 'Habilita simulações de vendas (texto e voz) no módulo Academy.', 'Treinamento', true),
  ('academy_ranking', 'Ranking Academy', 'Exibe ranking de desempenho dos vendedores no Academy.', 'Treinamento', true),
  ('qr_code_recepcao', 'QR Code Recepção', 'Permite check-in via QR Code na recepção de eventos.', 'Prospecção', true),
  ('convite_digital', 'Convite Digital', 'Gera convites digitais personalizados para eventos.', 'Prospecção', true),
  ('agentes_ia', 'Agentes IA', 'Módulo de gerenciamento de agentes de IA e cadências.', 'IA', true),
  ('cadencias_agente', 'Cadências de Agente', 'Permite configurar cadências automatizadas nos agentes IA.', 'IA', true),
  ('followups_agente', 'Follow-ups de Agente', 'Habilita follow-ups automáticos nos agentes de IA.', 'IA', true),
  ('opt_out_global', 'Opt-Out Global', 'Sistema de opt-out que bloqueia recontato em todos os canais.', 'Comunicação', true),
  ('dashboard_gastos_ligacao', 'Dashboard Gastos Ligação', 'Painel de custos e métricas Twilio/Vapi em tempo real.', 'Financeiro', true),
  ('relatorios_avancados', 'Relatórios Avançados', 'Acesso ao módulo de relatórios avançados.', 'Relatórios', true),
  ('multi_empresa', 'Multi-Empresa', 'Permite usuários alternarem entre múltiplas empresas.', 'Sistema', true),
  ('tema_escuro', 'Tema Escuro', 'Habilita o modo escuro na interface.', 'Sistema', true)
ON CONFLICT (flag_key) DO NOTHING;

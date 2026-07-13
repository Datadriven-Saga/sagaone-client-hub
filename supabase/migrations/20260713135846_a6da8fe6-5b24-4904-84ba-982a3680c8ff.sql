
-- Central de Webhooks: registro dinâmico de todos os webhooks externos
CREATE TABLE IF NOT EXISTS public.webhook_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'outros',
  agente text,
  url text,
  metodo text NOT NULL DEFAULT 'POST',
  ativo boolean NOT NULL DEFAULT true,
  credencial_secret_name text,
  credencial_header text,
  owner_edge_function text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_registry TO authenticated;
GRANT ALL ON public.webhook_registry TO service_role;

ALTER TABLE public.webhook_registry ENABLE ROW LEVEL SECURITY;

-- Somente Master pode visualizar/editar via UI. service_role (edge functions) bypassa RLS.
CREATE POLICY "webhook_registry_master_select" ON public.webhook_registry
  FOR SELECT TO authenticated
  USING (public.get_current_user_access_type() = 'Master');

CREATE POLICY "webhook_registry_master_update" ON public.webhook_registry
  FOR UPDATE TO authenticated
  USING (public.get_current_user_access_type() = 'Master')
  WITH CHECK (public.get_current_user_access_type() = 'Master');

CREATE POLICY "webhook_registry_master_insert" ON public.webhook_registry
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_access_type() = 'Master');

-- Audit trail
CREATE TABLE IF NOT EXISTS public.webhook_registry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.webhook_registry(id) ON DELETE SET NULL,
  slug text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,
  old_value text,
  new_value text
);

GRANT SELECT, INSERT ON public.webhook_registry_audit TO authenticated;
GRANT ALL ON public.webhook_registry_audit TO service_role;
ALTER TABLE public.webhook_registry_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_audit_master_select" ON public.webhook_registry_audit
  FOR SELECT TO authenticated
  USING (public.get_current_user_access_type() = 'Master');

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.webhook_registry_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_registry_touch ON public.webhook_registry;
CREATE TRIGGER trg_webhook_registry_touch BEFORE UPDATE ON public.webhook_registry
FOR EACH ROW EXECUTE FUNCTION public.webhook_registry_touch();

-- Trigger de audit
CREATE OR REPLACE FUNCTION public.webhook_registry_audit_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.url IS DISTINCT FROM NEW.url THEN
    INSERT INTO public.webhook_registry_audit(webhook_id, slug, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.slug, auth.uid(), 'url', OLD.url, NEW.url);
  END IF;
  IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    INSERT INTO public.webhook_registry_audit(webhook_id, slug, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.slug, auth.uid(), 'ativo', OLD.ativo::text, NEW.ativo::text);
  END IF;
  IF OLD.metodo IS DISTINCT FROM NEW.metodo THEN
    INSERT INTO public.webhook_registry_audit(webhook_id, slug, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.slug, auth.uid(), 'metodo', OLD.metodo, NEW.metodo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_registry_audit ON public.webhook_registry;
CREATE TRIGGER trg_webhook_registry_audit AFTER UPDATE ON public.webhook_registry
FOR EACH ROW EXECUTE FUNCTION public.webhook_registry_audit_trg();

-- RPC para edge functions resolverem URL
CREATE OR REPLACE FUNCTION public.get_webhook_url(_slug text)
RETURNS TABLE(url text, metodo text, ativo boolean, credencial_secret_name text, credencial_header text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.url, w.metodo, w.ativo, w.credencial_secret_name, w.credencial_header
  FROM public.webhook_registry w
  WHERE w.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_webhook_url(text) TO authenticated, service_role, anon;

-- RPC bulk (usada pelo external-webhook-proxy quando quiser cachear tudo de uma vez)
CREATE OR REPLACE FUNCTION public.list_active_webhooks()
RETURNS TABLE(slug text, url text, metodo text, credencial_secret_name text, credencial_header text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slug, url, metodo, credencial_secret_name, credencial_header
  FROM public.webhook_registry
  WHERE ativo = true AND url IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.list_active_webhooks() TO service_role;

-- Marcar utilização
CREATE OR REPLACE FUNCTION public.mark_webhook_used(_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.webhook_registry SET last_used_at = now() WHERE slug = _slug;
$$;

GRANT EXECUTE ON FUNCTION public.mark_webhook_used(text) TO service_role, authenticated;

-- ================= SEED =================
INSERT INTO public.webhook_registry (slug, nome, descricao, categoria, agente, url, metodo, credencial_secret_name, credencial_header, owner_edge_function) VALUES
-- Pós-Vendas (Paty)
('paty.pos_vendas.busca_config', 'Buscar configurações Pós-Vendas', 'Retorna as configurações gerais e faixas de KM cadastradas para a loja em Pós-Vendas.', 'pos_vendas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca_config_pos', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pos_vendas.config_gerais', 'Salvar regras gerais Pós-Vendas', 'Persiste horários, slots, revisões e demais regras gerais do agendamento Pós-Vendas.', 'pos_vendas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/config_gerais', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pos_vendas.upsert_ranges', 'Salvar faixas de KM Pós-Vendas', 'Cria/atualiza as faixas de KM associadas a cada nível de revisão.', 'pos_vendas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert_ranges', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pos_vendas.altera_status', 'Ativar/Desativar Pós-Vendas', 'Alterna o status ativo/inativo da loja no fluxo de Pós-Vendas.', 'pos_vendas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/altera_status_pos_vendas', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Paty Peças
('paty.pecas.busca_template', 'Buscar templates de Peças', 'Lista templates cadastrados para o módulo de Peças.', 'pecas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-pecas-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pecas.upsert_template', 'Salvar template de Peças', 'Cria ou atualiza template do módulo de Peças.', 'pecas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert-paty-pecas-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pecas.desativa_template', 'Desativar template de Peças', 'Desativa template do módulo de Peças.', 'pecas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/desativa-paty-pecas-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pecas.busca_prazo', 'Buscar prazos de Peças', 'Retorna configurações de prazos para o módulo de Peças.', 'pecas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-pecas-prazo', 'GET', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.pecas.upsert_prazo', 'Salvar prazos de Peças', 'Persiste prazos configurados no módulo de Peças.', 'pecas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert-paty-pecas-prazo', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Paty Entrega
('paty.entrega.busca_template', 'Buscar templates de Entrega', 'Lista templates do módulo de Entrega.', 'entrega', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-entrega-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.entrega.upsert_template', 'Salvar template de Entrega', 'Cria/atualiza template do módulo de Entrega.', 'entrega', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert-paty-entrega-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.entrega.desativa_template', 'Desativar template de Entrega', 'Desativa template do módulo de Entrega.', 'entrega', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/desativa-paty-entrega-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.entrega.remove_template', 'Remover template de Entrega', 'Remove definitivamente template do módulo de Entrega.', 'entrega', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/remove-paty-entrega-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Paty Cadência
('paty.cadencia.busca_config_template', 'Buscar cadência - config template', 'Retorna templates da cadência configurada.', 'cadencia', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-cadencia-config-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.cadencia.upsert_config_template', 'Salvar cadência - config template', 'Persiste configuração de template da cadência.', 'cadencia', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert-paty-cadencia-config-template', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.cadencia.busca_steps', 'Buscar cadência - steps', 'Lista steps da cadência configurada.', 'cadencia', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-cadencia-steps', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.cadencia.upsert_steps', 'Salvar cadência - steps', 'Cria/atualiza steps da cadência.', 'cadencia', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upsert-paty-cadencia-steps', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.cadencia.delete_step', 'Excluir cadência - step', 'Remove step específico da cadência.', 'cadencia', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/delete-paty-cadencia-step', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Paty Lojas
('paty.lojas.busca_ids', 'Buscar Paty - lojas IDs', 'Retorna vinculação de agentes Paty por loja.', 'lojas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-paty-lojas-ids', 'GET', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.lojas.atualiza_ids', 'Atualizar Paty - lojas IDs', 'Atualiza vinculação de agentes Paty por loja.', 'lojas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-paty-lojas-ids', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('paty.lojas.insere_ids', 'Inserir Paty - lojas IDs', 'Cria vinculação de agente Paty a uma loja.', 'lojas', 'paty', 'https://automatemaiawh.sagadatadriven.com.br/webhook/insere-paty-lojas-ids', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- PRI WhatsApp - Templates Meta
('pri_wpp.templates.apaga_meta', 'Apagar template na Meta', 'Remove template WhatsApp diretamente na Meta.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/apaga-template-meta', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_wpp.templates.verifica', 'Verificar templates', 'Sincroniza status/aprovação dos templates com a Meta.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-templates', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_wpp.templates.upload_media', 'Upload de mídia Meta', 'Envia mídia para aprovação/uso em templates Meta.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/upload-media-meta', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_wpp.templates.criar_from_meta', 'Criar template PRI a partir da Meta', 'Cria template no sistema PRI clonando da Meta.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/criar-template-pri-from-meta', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- PRI WhatsApp - Evolution / Instâncias
('pri_wpp.evo.verifica_instancias', 'Verificar instâncias Evolution', 'Retorna instâncias Evolution ativas por empresa.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_wpp.evo.atualiza_instancias', 'Atualizar instâncias Evolution', 'Atualiza configuração das instâncias Evolution.', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_wpp.envia_mensagem', 'Enviar mensagem WhatsApp', 'Dispara envio individual de mensagem WhatsApp (usado em EnvioMensagemConfig).', 'whatsapp', 'pri_wpp', 'https://automatemaiawh.sagadatadriven.com.br/webhook/envia_mensagem', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'trigger-webhook'),
-- PRI Voz - Eventos
('pri_voz.eventos.cria_evento', 'Criar evento de ligação', 'Cria evento de campanha de ligação IA no SagaOne.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-evento-ligacao', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'ia-ligacao-webhook'),
('pri_voz.eventos.atualiza_evento', 'Atualizar evento de ligação', 'Atualiza dados de evento de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-evento-ligacao', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'ia-ligacao-webhook'),
('pri_voz.eventos.ativa', 'Ativar evento ligação', 'Ativa evento de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/ativa-evento', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'eventos-ligacao-proxy'),
('pri_voz.eventos.desativa', 'Desativar evento ligação', 'Desativa evento de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/desativa-evento', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'eventos-ligacao-proxy'),
('pri_voz.eventos.deleta', 'Deletar evento SagaOne', 'Remove evento de ligação no SagaOne.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/deleta-eventos-saga-one', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'eventos-ligacao-proxy'),
('pri_voz.eventos.list_all', 'Listar todos eventos PRI', 'Lista todos os eventos PRI (visão administrativa).', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos-pri', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.eventos.list', 'Listar eventos ligação', 'Lista eventos de ligação da empresa.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.eventos.verifica_by_id', 'Verificar evento por ID', 'Verifica existência/status de evento pelo ID.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica_eventos_id', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.eventos.eventos_pri', 'Eventos PRI (base)', 'Endpoint genérico eventos-pri.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/eventos-pri', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'eventos-ligacao-proxy'),
-- PRI Voz - Contatos / Base
('pri_voz.contatos.verifica', 'Verificar contatos ligação', 'Sincroniza contatos processados nos eventos de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'sync-contatos-ligacao'),
('pri_voz.base.cria_base', 'Criar base de ligação', 'Envia base de contatos importada para agente de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'create-base-ligacao'),
('pri_voz.dispara_ligacao', 'Disparar ligação', 'Dispara ligação para lead via agente IA.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/dispara-ligacao', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'process-campaign-job'),
('pri_voz.cadencia', 'Cadência de ligação', 'Executa cadência de tentativas de ligação.', 'ligacao', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'trigger-webhook'),
-- PRI Voz - Agentes
('pri_voz.agentes.busca_dados', 'Buscar dados dos agentes', 'Retorna dados/configuração dos agentes de voz.', 'agentes', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/busca-dados-agentes', 'GET', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.agentes.cria', 'Criar agente', 'Cria novo agente de voz.', 'agentes', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-agente', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.agentes.atualiza', 'Atualizar agente', 'Atualiza configuração de agente de voz.', 'agentes', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-agente', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('pri_voz.agentes.pri_config', 'PRI config', 'Configurações gerais PRI.', 'agentes', 'pri_voz', 'https://automatemaiawh.sagadatadriven.com.br/webhook/pri-config', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Sistema - Lojas SagaOne
('sistema.lojas.insere', 'Inserir loja', 'Cria loja no SagaOne.', 'lojas', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/insere-loja', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('sistema.lojas.verifica', 'Verificar lojas', 'Lista lojas SagaOne.', 'lojas', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifca-lojas', 'GET', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('sistema.lojas.update_gaia', 'Atualizar lojas Gaia', 'Sincroniza lojas com sistema Gaia.', 'lojas', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/update-lojas-gaia', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Sistema - Dashboards / Métricas
('sistema.dashboard.evento_pri_whats', 'Dashboard WhatsApp por evento', 'Métricas do dashboard PRI WhatsApp por evento.', 'dashboards', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/dashboard-evento-pri-whats', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
('sistema.dashboard.evento_pri_whats_adm', 'Dashboard WhatsApp administrativo', 'Dashboard WhatsApp visão administrativa (multi-empresa).', 'dashboards', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/dashboard-evento-pri-whats-adm', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'AdminDashboardWhatsApp'),
('sistema.dashboard.visao_admin_ligacao', 'Visão administrativa ligação', 'Busca dashboard administrativo de ligação.', 'dashboards', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/visao_administrativa', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'AdminDashboardLigacao'),
('sistema.dashboard.verifica_todos_eventos', 'Todos eventos ligação (admin)', 'Lista todos eventos de ligação para admin dashboard.', 'dashboards', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'AdminDashboardLigacao'),
('sistema.sincroniza_sagaone', 'Sincronizar SagaOne', 'Sincronização geral com SagaOne.', 'sincronizacao', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/sincroniza_sagaone', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'sync-pri-dashboard'),
('sistema.metricas', 'Métricas gerais', 'Endpoint de métricas gerais.', 'dashboards', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/metricas', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'external-webhook-proxy'),
-- Sistema - Status / CRM
('sistema.status.recebe_sagaone', 'Recebe status SagaOne', 'Recebe atualizações de status do SagaOne para o atendimento.', 'status', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/recebe-status-sagaone', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'atendimento-status-webhook'),
('sistema.crm.evento_email', 'Evento CRM por email', 'Notifica evento CRM via email através do n8n.', 'notificacoes', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/evento-crm-email', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'send-crm-event-email'),
-- Sistema - Base admin (usa SAGA_ONE_ADMIN_TOKEN)
('sistema.admin.base_wh', 'Base URL n8n (webhook)', 'URL base do n8n usada por integrações administrativas (search-lead, create-lead, etc).', 'infra', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br', 'POST', 'SAGA_ONE_ADMIN_TOKEN', 'Authorization', 'multiplas'),
('sistema.admin.base_api', 'Base URL n8n (API)', 'URL base secundária n8n (automatemaia sem wh).', 'infra', 'sistema', 'https://automatemaia.sagadatadriven.com.br', 'POST', 'SAGA_ONE_ADMIN_TOKEN', 'Authorization', 'multiplas'),
-- Maia proxy
('maia.chat.proxy', 'Maia chat proxy', 'Proxy para chat da Maia (workflow n8n 8275b29e).', 'assistente', 'sistema', 'https://automatemaiawh.sagadatadriven.com.br/webhook/8275b29e-b3b1-494d-a604-b285a8cc0d56', 'POST', 'SAGA_ONE', 'saga_one_supabase', 'maia-webhook-proxy')
ON CONFLICT (slug) DO NOTHING;

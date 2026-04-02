
-- Function to auto-create standard gatilhos for a new empresa
CREATE OR REPLACE FUNCTION public.create_standard_gatilhos_for_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Novo Template WhatsApp
  INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
  VALUES (
    'Novo Template',
    'Gatilho padrão para criação de templates WhatsApp',
    'Evento'::tipo_gatilho,
    'Ativo'::status_gatilho,
    NEW.id,
    '{"tipo_evento": "novo_template_whatsapp", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/novo-template"}'::jsonb
  );

  -- Evento Criado ou Alterado
  INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
  VALUES (
    'Evento Criado ou Alterado',
    'Gatilho padrão para notificar criação/alteração de eventos',
    'Evento'::tipo_gatilho,
    'Ativo'::status_gatilho,
    NEW.id,
    '{"tipo_evento": "novo_evento_criado", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/evento-criado-alterado"}'::jsonb
  );

  -- Atualizar Status Meta
  INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
  VALUES (
    'Atualizar Status Meta dos Templates',
    'Gatilho padrão para verificação de status dos templates na Meta',
    'Evento'::tipo_gatilho,
    'Ativo'::status_gatilho,
    NEW.id,
    '{"tipo_evento": "atualiza_status_meta", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-templates"}'::jsonb
  );

  RETURN NEW;
END;
$$;

-- Trigger on empresas table
DROP TRIGGER IF EXISTS trg_create_standard_gatilhos ON public.empresas;
CREATE TRIGGER trg_create_standard_gatilhos
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.create_standard_gatilhos_for_empresa();

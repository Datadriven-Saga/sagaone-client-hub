
-- Insert standard gatilhos for all companies that are missing them
-- 1. novo_template_whatsapp
INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
SELECT 
  'Novo Template',
  'Gatilho padrão para criação de templates WhatsApp',
  'Evento'::tipo_gatilho,
  'Ativo'::status_gatilho,
  e.id,
  '{"tipo_evento": "novo_template_whatsapp", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/novo-template"}'::jsonb
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.acoes->>'tipo_evento' = 'novo_template_whatsapp'
);

-- 2. novo_evento_criado
INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
SELECT 
  'Evento Criado ou Alterado',
  'Gatilho padrão para notificar criação/alteração de eventos',
  'Evento'::tipo_gatilho,
  'Ativo'::status_gatilho,
  e.id,
  '{"tipo_evento": "novo_evento_criado", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/evento-criado-alterado"}'::jsonb
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.acoes->>'tipo_evento' = 'novo_evento_criado'
);

-- 3. atualiza_status_meta
INSERT INTO public.gatilhos (nome, descricao, tipo, status, empresa_id, acoes)
SELECT 
  'Atualizar Status Meta dos Templates',
  'Gatilho padrão para verificação de status dos templates na Meta',
  'Evento'::tipo_gatilho,
  'Ativo'::status_gatilho,
  e.id,
  '{"tipo_evento": "atualiza_status_meta", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-templates"}'::jsonb
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.acoes->>'tipo_evento' = 'atualiza_status_meta'
);

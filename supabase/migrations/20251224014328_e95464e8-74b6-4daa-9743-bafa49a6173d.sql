
-- Inserir os 3 gatilhos da Saga BYD BSB em todas as empresas que ainda não os têm
-- Gatilho 1: Novo Template
INSERT INTO gatilhos (nome, descricao, tipo, status, empresa_id, acoes, criado_por)
SELECT 
  'Novo Template',
  'quando criar ou alterar um template de whatsapp deve chamar esse template e enviar todos os dados salvos no template com as informações e no layout que a meta espera',
  'Evento',
  'Ativo',
  e.id,
  '{"tipo_evento": "novo_template_whatsapp", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/novo-template"}'::jsonb,
  'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00'
FROM empresas e
WHERE e.id != '3f3bcf4b-ce75-4f28-921b-177c7a77a7b0'
AND NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.nome = 'Novo Template'
);

-- Gatilho 2: Evento Criado ou Alterado
INSERT INTO gatilhos (nome, descricao, tipo, status, empresa_id, acoes, criado_por)
SELECT 
  'Evento Criado ou Alterado',
  'Este gatilho deve ser acionado quanto um evento for criado ou alterado lá dentro do modulo de prospecção, submodulos eventos',
  'Evento',
  'Ativo',
  e.id,
  '{"tipo_evento": "novo_evento_criado", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/evento-criado-alterado"}'::jsonb,
  'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00'
FROM empresas e
WHERE e.id != '3f3bcf4b-ce75-4f28-921b-177c7a77a7b0'
AND NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.nome = 'Evento Criado ou Alterado'
);

-- Gatilho 3: Atualizar Status Meta dos Templates
INSERT INTO gatilhos (nome, descricao, tipo, status, empresa_id, acoes, criado_por)
SELECT 
  'Atualizar Status Meta dos Templates',
  'Esse gatilho deve ser chamado sempre que entrar no módulo Template, ou o usuário apertar o botão Atualizar Status.',
  'Evento',
  'Ativo',
  e.id,
  '{"tipo_evento": "atualiza_status_meta", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-templates"}'::jsonb,
  'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00'
FROM empresas e
WHERE e.id != '3f3bcf4b-ce75-4f28-921b-177c7a77a7b0'
AND NOT EXISTS (
  SELECT 1 FROM gatilhos g 
  WHERE g.empresa_id = e.id 
  AND g.nome = 'Atualizar Status Meta dos Templates'
);

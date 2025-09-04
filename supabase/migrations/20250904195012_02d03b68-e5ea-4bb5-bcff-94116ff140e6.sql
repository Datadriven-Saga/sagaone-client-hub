-- Criar dados de teste para verificar os relacionamentos

-- Inserir algumas prospecções de teste
INSERT INTO public.prospeccoes (
  titulo, 
  descricao, 
  canal, 
  empresa_id, 
  data_inicio, 
  data_fim, 
  meta_leads,
  responsavel_id,
  objetivo_vendas
) VALUES 
(
  'Campanha Black Friday 2024', 
  'Prospecção para vendas da Black Friday', 
  'Whatsapp', 
  '00000000-0000-0000-0000-000000000001', 
  '2024-11-01', 
  '2024-11-30', 
  500,
  '2883b54b-7775-40b0-82f3-f1a9d29bb061',
  'Aumentar vendas em 30%'
),
(
  'Campanha Natal 2024', 
  'Prospecção para vendas natalinas', 
  'Ligação', 
  '00000000-0000-0000-0000-000000000001', 
  '2024-12-01', 
  '2024-12-25', 
  300,
  '2883b54b-7775-40b0-82f3-f1a9d29bb061',
  'Foco em presentes'
);

-- Inserir alguns contatos de teste
INSERT INTO public.contatos (
  nome,
  telefone, 
  email,
  status,
  origem,
  empresa_id,
  responsavel_email,
  observacoes
) VALUES 
(
  'João Silva',
  '11999888777',
  'joao@email.com',
  'Novo',
  'WhatsApp',
  '00000000-0000-0000-0000-000000000001',
  null,
  'Contato via WhatsApp business'
),
(
  'Maria Santos',
  '11888777666', 
  'maria@email.com',
  'Negociação',
  'Instagram',
  '00000000-0000-0000-0000-000000000001',
  'fernando@email.com',
  'Interessada em produtos premium'
),
(
  'Pedro Costa',
  '11777666555',
  'pedro@email.com', 
  'Em Contato',
  'Facebook',
  '00000000-0000-0000-0000-000000000001',
  null,
  'Lead qualificado do Facebook Ads'
),
(
  'Ana Oliveira',
  '11666555444',
  'ana@email.com',
  'Qualificado', 
  'Google',
  '00000000-0000-0000-0000-000000000001',
  'fernando@email.com',
  'Encontrou via Google Search'
),
(
  'Carlos Ferreira',
  '11555444333',
  'carlos@email.com',
  'Fechado',
  'Indicação',
  '00000000-0000-0000-0000-000000000001',
  'fernando@email.com',
  'Indicado por cliente existente'
);
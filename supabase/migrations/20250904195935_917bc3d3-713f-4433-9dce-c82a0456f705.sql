-- Criar dados de teste para a empresa ativa do usuário moreira.it@gmail.com
-- Empresa ID: 00000000-0000-0000-0000-000000000001 (Empresa Padrão)

-- Inserir prospecções de teste
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
  'Teste Campanha 2025', 
  'Campanha de teste para verificar funcionamento', 
  'Whatsapp', 
  '00000000-0000-0000-0000-000000000001', 
  '2025-01-01', 
  '2025-01-31', 
  100,
  'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00',
  'Testar sistema de prospecção'
);

-- Inserir contatos de teste
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
  'Cliente Teste 1',
  '11999999999',
  'teste1@email.com',
  'Novo',
  'WhatsApp',
  '00000000-0000-0000-0000-000000000001',
  null,
  'Contato de teste para verificar funcionamento'
),
(
  'Cliente Teste 2',
  '11888888888', 
  'teste2@email.com',
  'Negociação',
  'Instagram',
  '00000000-0000-0000-0000-000000000001',
  'moreira.it@gmail.com',
  'Segundo contato de teste'
);
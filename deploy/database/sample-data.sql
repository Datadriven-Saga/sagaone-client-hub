-- ==========================================
-- DADOS DE EXEMPLO PARA TESTE
-- Sistema de CRM e Prospecção com Agentes IA
-- ==========================================

-- Inserir empresa de exemplo
INSERT INTO public.empresas (
  id,
  nome_empresa,
  cnpj,
  marca,
  uf,
  responsavel_legal_nome,
  responsavel_legal_email,
  responsavel_legal_telefone
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'Empresa Demo LTDA',
  '12.345.678/0001-90',
  'Demo Corp',
  'SP',
  'João Silva',
  'joao@demo.com',
  '(11) 99999-9999'
) ON CONFLICT (id) DO NOTHING;

-- Inserir tipos de notificação padrão
INSERT INTO public.tipos_notificacao (nome, descricao, template_padrao) VALUES
('boas_vindas', 'Mensagem de boas-vindas para novos usuários', 'Bem-vindo ao sistema! Esperamos que tenha uma ótima experiência.'),
('novo_lead', 'Notificação de novo lead capturado', 'Novo lead capturado: {{nome}} - {{telefone}}'),
('followup_agendado', 'Lembrete de followup agendado', 'Lembrete: Followup agendado com {{nome}} às {{horario}}'),
('meta_atingida', 'Notificação quando meta é atingida', 'Parabéns! Você atingiu sua meta de {{tipo}}: {{valor}}'),
('venda_realizada', 'Notificação de nova venda', 'Nova venda realizada: {{valor}} para {{cliente}}')
ON CONFLICT DO NOTHING;

-- Inserir personas de exemplo
INSERT INTO public.personas (
  nome,
  descricao,
  personalidade,
  instrucoes_sistema,
  empresa_id,
  status
) VALUES (
  'Vendedor Consultivo',
  'Persona focada em vendas consultivas com abordagem educativa',
  'Profissional, educativo, focado em resolver problemas do cliente. Sempre pergunta sobre necessidades antes de apresentar soluções.',
  'Você é um vendedor consultivo experiente. Sempre faça perguntas para entender a necessidade do cliente antes de apresentar qualquer produto ou serviço. Seja educativo e ajude o cliente a tomar a melhor decisão.',
  '123e4567-e89b-12d3-a456-426614174000',
  'Ativa'
),
(
  'Atendimento Cordial',
  'Persona para atendimento ao cliente com foco em suporte',
  'Simpático, prestativo, paciente. Sempre disposto a ajudar e resolver problemas.',
  'Você trabalha no atendimento ao cliente. Seja sempre cordial, paciente e focado em resolver o problema do cliente. Use linguagem clara e simples.',
  '123e4567-e89b-12d3-a456-426614174000',
  'Ativa'
)
ON CONFLICT DO NOTHING;

-- Inserir produtos de exemplo
INSERT INTO public.produtos (
  nome,
  descricao,
  categoria,
  preco,
  estoque,
  empresa_id
) VALUES
('Produto Demo A', 'Produto de demonstração categoria A', 'Categoria A', 299.99, 100, '123e4567-e89b-12d3-a456-426614174000'),
('Produto Demo B', 'Produto de demonstração categoria B', 'Categoria B', 599.99, 50, '123e4567-e89b-12d3-a456-426614174000'),
('Serviço Demo', 'Serviço de demonstração', 'Serviços', 999.99, 999, '123e4567-e89b-12d3-a456-426614174000')
ON CONFLICT DO NOTHING;

-- Inserir metas de exemplo
INSERT INTO public.metas (
  titulo,
  descricao,
  tipo,
  valor_meta,
  valor_atual,
  data_inicio,
  data_fim,
  empresa_id
) VALUES
('Meta de Vendas Mensal', 'Meta de vendas para o mês atual', 'Vendas', 50000.00, 0, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '123e4567-e89b-12d3-a456-426614174000'),
('Meta de Leads Semanal', 'Capturar novos leads na semana', 'Leads', 100, 0, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', '123e4567-e89b-12d3-a456-426614174000')
ON CONFLICT DO NOTHING;

-- Inserir treinamentos de exemplo
INSERT INTO public.treinamentos (
  titulo,
  descricao,
  conteudo,
  categoria,
  nivel,
  duracao_minutos,
  empresa_id
) VALUES
('Introdução ao Sistema', 'Treinamento básico sobre como usar o sistema CRM', 'Este treinamento cobre os fundamentos do sistema...', 'Sistema', 'Básico', 60, '123e4567-e89b-12d3-a456-426614174000'),
('Técnicas de Vendas', 'Aprenda técnicas avançadas de vendas', 'Neste módulo você aprenderá...', 'Vendas', 'Intermediário', 120, '123e4567-e89b-12d3-a456-426614174000'),
('Atendimento ao Cliente', 'Como proporcionar excelência no atendimento', 'O atendimento ao cliente é fundamental...', 'Atendimento', 'Básico', 90, '123e4567-e89b-12d3-a456-426614174000')
ON CONFLICT DO NOTHING;

-- Comentário
COMMENT ON SCHEMA public IS 'Dados de exemplo inseridos para demonstração e teste do sistema';
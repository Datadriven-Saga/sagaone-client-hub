-- Inserir simulações de exemplo para o Saga Academy
INSERT INTO public.academy_simulacoes (titulo, descricao, tipo, ativo, cenario, config_voz, criterios_avaliacao) VALUES
(
  'Atendimento Veículo Novo',
  'Simulação de venda de veículo novo em showroom',
  'voz',
  true,
  '{
    "departamento": "Vendas Novos",
    "contexto": "Cliente interessado em SUV para uso familiar",
    "objetivo": "Identificar necessidades e apresentar o veículo ideal",
    "personas": [
      {
        "id": "p1",
        "nome": "Lucas",
        "cargo": "Gerente comercial",
        "empresa": "Shopping ACME",
        "dificuldade": "Médio",
        "descricao": "Cliente interessado em Compass",
        "objetivo": "Conhecer o veículo e tirar dúvidas sobre financiamento"
      },
      {
        "id": "p2",
        "nome": "Marina",
        "cargo": "Empresária",
        "empresa": "Tech Solutions",
        "dificuldade": "Difícil",
        "descricao": "Cliente exigente buscando SUV premium",
        "objetivo": "Comparar modelos e negociar preço"
      }
    ]
  }'::jsonb,
  '{"voz_openai": "shimmer"}'::jsonb,
  '{"dimensoes": [{"nome": "Situação", "peso": 20}, {"nome": "Problema", "peso": 20}, {"nome": "Implicação", "peso": 20}, {"nome": "Negociação e Objeção", "peso": 20}, {"nome": "Fechamento e Próximos Passos", "peso": 20}]}'::jsonb
),
(
  'Diagnóstico - Pós-Venda',
  'Atendimento de cliente na oficina para diagnóstico',
  'voz',
  true,
  '{
    "departamento": "Pós-Venda",
    "contexto": "Cliente chegando para revisão programada",
    "objetivo": "Realizar diagnóstico e identificar serviços adicionais",
    "personas": [
      {
        "id": "p3",
        "nome": "Carlos",
        "cargo": "Engenheiro",
        "empresa": "Construtora ABC",
        "dificuldade": "Fácil",
        "descricao": "Cliente levando carro para revisão programada",
        "objetivo": "Realizar revisão e verificar possíveis manutenções adicionais"
      }
    ]
  }'::jsonb,
  '{"voz_openai": "echo"}'::jsonb,
  '{"dimensoes": [{"nome": "Situação", "peso": 20}, {"nome": "Problema", "peso": 20}, {"nome": "Implicação", "peso": 20}, {"nome": "Negociação e Objeção", "peso": 20}, {"nome": "Fechamento e Próximos Passos", "peso": 20}]}'::jsonb
),
(
  'Negociação de Financiamento',
  'Simulação de negociação de condições de financiamento',
  'texto',
  true,
  '{
    "departamento": "F&I",
    "contexto": "Cliente quer financiar veículo mas está comparando taxas",
    "objetivo": "Apresentar as melhores condições e fechar negócio",
    "personas": [
      {
        "id": "p4",
        "nome": "Roberto",
        "cargo": "Contador",
        "empresa": "Escritório Contábil XYZ",
        "dificuldade": "Difícil",
        "descricao": "Cliente analítico que compara todas as taxas",
        "objetivo": "Negociar a menor taxa possível"
      },
      {
        "id": "p5",
        "nome": "Patricia",
        "cargo": "Professora",
        "empresa": "Escola Municipal",
        "dificuldade": "Médio",
        "descricao": "Cliente com renda fixa buscando parcelas acessíveis",
        "objetivo": "Encontrar parcela que caiba no orçamento"
      }
    ]
  }'::jsonb,
  null,
  '{"dimensoes": [{"nome": "Situação", "peso": 20}, {"nome": "Problema", "peso": 20}, {"nome": "Implicação", "peso": 20}, {"nome": "Negociação e Objeção", "peso": 20}, {"nome": "Fechamento e Próximos Passos", "peso": 20}]}'::jsonb
),
(
  'Tratamento de Objeções',
  'Simulação focada em lidar com objeções de preço e concorrência',
  'texto',
  true,
  '{
    "departamento": "Vendas Seminovos",
    "contexto": "Cliente interessado mas comparando com concorrência",
    "objetivo": "Contornar objeções e demonstrar valor",
    "personas": [
      {
        "id": "p6",
        "nome": "Fernando",
        "cargo": "Vendedor",
        "empresa": "Loja de Roupas",
        "dificuldade": "Difícil",
        "descricao": "Cliente que pesquisou muito e tem várias objeções",
        "objetivo": "Fechar negócio com desconto máximo"
      }
    ]
  }'::jsonb,
  null,
  '{"dimensoes": [{"nome": "Situação", "peso": 20}, {"nome": "Problema", "peso": 20}, {"nome": "Implicação", "peso": 20}, {"nome": "Negociação e Objeção", "peso": 20}, {"nome": "Fechamento e Próximos Passos", "peso": 20}]}'::jsonb
);
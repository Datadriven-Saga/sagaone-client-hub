-- Criar agentes Bia e Gaia baseados no agente Pri
WITH agente_pri AS (
  SELECT * FROM public.agentes_ia 
  WHERE nome = 'Pri' 
  AND empresa_id = '16b78451-ab3b-4ca6-85a5-eef303b8c7de' 
  LIMIT 1
),
agente_bia AS (
  INSERT INTO public.agentes_ia (
    nome, persona, cerebro, telefone, foto_url, ativo, empresa_id, criado_por
  ) 
  SELECT 
    'Bia',
    persona,
    REPLACE(cerebro, 'Você é a **Pri**', 'Você é a **Bia**'),
    telefone,
    foto_url,
    ativo,
    empresa_id,
    auth.uid()
  FROM agente_pri
  RETURNING id, empresa_id
),
agente_gaia AS (
  INSERT INTO public.agentes_ia (
    nome, persona, cerebro, telefone, foto_url, ativo, empresa_id, criado_por
  ) 
  SELECT 
    'Gaia',
    persona,
    REPLACE(cerebro, 'Você é a **Pri**', 'Você é a **Gaia**'),
    telefone,
    foto_url,
    ativo,
    empresa_id,
    auth.uid()
  FROM agente_pri
  RETURNING id, empresa_id
),
cadencias_bia AS (
  INSERT INTO public.agente_cadencias (
    agente_id, gatilho_cadencia, ativo, timezone, dias_semana, 
    horario_fim, horario_inicio, intervalo_etapas_minutos, 
    delay_inicial_minutos, quantidade_etapas, empresa_id
  ) 
  SELECT 
    ab.id,
    ac.gatilho_cadencia,
    ac.ativo,
    ac.timezone,
    ac.dias_semana,
    ac.horario_fim,
    ac.horario_inicio,
    ac.intervalo_etapas_minutos,
    ac.delay_inicial_minutos,
    ac.quantidade_etapas,
    ab.empresa_id
  FROM agente_bia ab
  CROSS JOIN agente_cadencias ac
  CROSS JOIN agente_pri ap
  WHERE ac.agente_id = ap.id
  RETURNING agente_id
),
cadencias_gaia AS (
  INSERT INTO public.agente_cadencias (
    agente_id, gatilho_cadencia, ativo, timezone, dias_semana, 
    horario_fim, horario_inicio, intervalo_etapas_minutos, 
    delay_inicial_minutos, quantidade_etapas, empresa_id
  ) 
  SELECT 
    ag.id,
    ac.gatilho_cadencia,
    ac.ativo,
    ac.timezone,
    ac.dias_semana,
    ac.horario_fim,
    ac.horario_inicio,
    ac.intervalo_etapas_minutos,
    ac.delay_inicial_minutos,
    ac.quantidade_etapas,
    ag.empresa_id
  FROM agente_gaia ag
  CROSS JOIN agente_cadencias ac
  CROSS JOIN agente_pri ap
  WHERE ac.agente_id = ap.id
  RETURNING agente_id
),
integracoes_bia AS (
  INSERT INTO public.agente_integracoes (
    agente_id, evolution_id, banco_dados_ia, tabela_historico_ia,
    webhook_metodo, webhook_url, ativo, empresa_id
  ) 
  SELECT 
    ab.id,
    ai.evolution_id,
    ai.banco_dados_ia,
    ai.tabela_historico_ia,
    ai.webhook_metodo,
    ai.webhook_url,
    ai.ativo,
    ab.empresa_id
  FROM agente_bia ab
  CROSS JOIN agente_integracoes ai
  CROSS JOIN agente_pri ap
  WHERE ai.agente_id = ap.id
  RETURNING agente_id
),
integracoes_gaia AS (
  INSERT INTO public.agente_integracoes (
    agente_id, evolution_id, banco_dados_ia, tabela_historico_ia,
    webhook_metodo, webhook_url, ativo, empresa_id
  ) 
  SELECT 
    ag.id,
    ai.evolution_id,
    ai.banco_dados_ia,
    ai.tabela_historico_ia,
    ai.webhook_metodo,
    ai.webhook_url,
    ai.ativo,
    ag.empresa_id
  FROM agente_gaia ag
  CROSS JOIN agente_integracoes ai
  CROSS JOIN agente_pri ap
  WHERE ai.agente_id = ap.id
  RETURNING agente_id
),
followups_bia AS (
  INSERT INTO public.agente_followups (
    agente_id, nome, descricao, tipo, webhook_url, ativo, empresa_id, criado_por, acoes, condicoes
  ) 
  SELECT 
    ab.id,
    af.nome,
    af.descricao,
    af.tipo,
    af.webhook_url,
    af.ativo,
    ab.empresa_id,
    auth.uid(),
    af.acoes,
    af.condicoes
  FROM agente_bia ab
  CROSS JOIN agente_followups af
  CROSS JOIN agente_pri ap
  WHERE af.agente_id = ap.id
  RETURNING agente_id
)
INSERT INTO public.agente_followups (
  agente_id, nome, descricao, tipo, webhook_url, ativo, empresa_id, criado_por, acoes, condicoes
) 
SELECT 
  ag.id,
  af.nome,
  af.descricao,
  af.tipo,
  af.webhook_url,
  af.ativo,
  ag.empresa_id,
  auth.uid(),
  af.acoes,
  af.condicoes
FROM agente_gaia ag
CROSS JOIN agente_followups af
CROSS JOIN agente_pri ap
WHERE af.agente_id = ap.id;
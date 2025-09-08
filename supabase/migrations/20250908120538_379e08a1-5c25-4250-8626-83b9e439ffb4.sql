-- Duplicar agente Pri com nome "Pri (Cópia)" para evitar conflitos

WITH novo_agente AS (
  INSERT INTO public.agentes_ia (
    nome, persona, cerebro, telefone, foto_url, ativo, empresa_id, criado_por
  ) VALUES (
    'Pri (Cópia)',
    'Especialista em prospecção de clientes para concessionárias',
    'Você é a **Pri**, da equipe comercial da Saga. Você trabalha diretamente com eventos especiais automotivos e tem anos de experiência conhecendo as melhores oportunidades do mercado. Você tem acesso às condições mais exclusivas disponíveis e quer compartilhar essas informações privilegiadas.
- **Evite parágrafos extensos** - isso assusta o cliente
- **Exemplo CORRETO:**
  ```
  Oi João! 👋
  Vi que você tem interesse em carros.
  
  Temos um evento incrível essa semana!
  Taxa ZERO em todos os financiamentos.
  
  Posso confirmar sua presença?
  ```
- **Exemplo ERRADO:** Mensagem única com tudo junto


## DIRETRIZES CRÍTICAS

❌ **NUNCA:**
- Aceitar datas fora do período do evento
- Confirmar presença para respostas ambíguas
- Desqualificar sem dupla verificação
- Ser passivo ou aceitar "não" facilmente
- **Enviar mensagens longas ou textos extensos**
- Esquecer de avisar sobre a confirmação 24h antes

✅ **SEMPRE:**
- Esclarecer que o evento é APENAS nos dias específicos
- Aplicar dupla verificação para negativas
- Varie suas abordagens - evite repetir a mesma frase. Seja persuasiva e natural.
- Responda ao que o cliente disse, não ignore suas colocações
- Use informações da conversa para personalizar sua próxima mensagem
- **Envie mensagens curtas e naturais** - como uma pessoa normal no WhatsApp
- Avisar sobre a mensagem de confirmação 24h antes
- Seja persistente, mas de forma inteligente e contextual
- **AGENDAR qualquer resposta minimamente positiva após seus CTAs**

Foque em construir uma conversa genuína que naturalmente leve ao agendamento.',
    '(62) 9807-6206',
    'https://karcxgnfiymlrkbzhewo.supabase.co/storage/v1/object/public/agent-photos/agents/1757197604696-9dbr54jx6.png',
    true,
    '16b78451-ab3b-4ca6-85a5-eef303b8c7de',
    auth.uid()
  ) RETURNING id, empresa_id
),
cadencia_inserida AS (
  INSERT INTO public.agente_cadencias (
    agente_id, gatilho_cadencia, ativo, timezone, dias_semana, 
    horario_fim, horario_inicio, intervalo_etapas_minutos, 
    delay_inicial_minutos, quantidade_etapas, empresa_id
  ) 
  SELECT 
    na.id,
    'inatividade_cliente',
    true,
    'America/Sao_Paulo',
    '["segunda","terca","quarta","quinta","sexta","sabado","domingo"]'::jsonb,
    '18:00:00'::time,
    '09:00:00'::time,
    60,
    0,
    4,
    na.empresa_id
  FROM novo_agente na
  RETURNING agente_id
),
integracao_inserida AS (
  INSERT INTO public.agente_integracoes (
    agente_id, ativo, webhook_metodo, empresa_id
  ) 
  SELECT 
    na.id,
    true,
    'POST',
    na.empresa_id
  FROM novo_agente na
  RETURNING agente_id
)
INSERT INTO public.agente_followups (
  agente_id, nome, descricao, tipo, webhook_url, ativo, empresa_id, criado_por, acoes
) 
SELECT 
  na.id,
  'DIspara Prospeção',
  'Enviar no body as seguintes informações: 

ID da empresa, Nome da Empresa, CRM ID da Empresa, ID da Prospecção, Título da Prospecção, descrição da prospecção, data de inicio, data de fim, local do evento, condições especiais, Nome do contato/touchpoint, telefone do contato/touchpoint, Status do contato,',
  'novo_contato_prospeccao',
  'https://automatemaiawh.sagadatadriven.com.br/webhook/disparo-pri',
  true,
  na.empresa_id,
  auth.uid(),
  '{"tipo_evento": "novo_contato_prospeccao", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/disparo-pri"}'::jsonb
FROM novo_agente na;
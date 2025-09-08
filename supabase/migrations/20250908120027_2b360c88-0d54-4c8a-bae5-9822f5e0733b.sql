-- Duplicar agente Pri da Saga Toyota T7 para a empresa atual do usuário

-- 1. Inserir novo agente IA
INSERT INTO public.agentes_ia (
  nome, persona, cerebro, telefone, foto_url, ativo, empresa_id, criado_por
) VALUES (
  'Pri',
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
  get_user_active_company(auth.uid()),
  auth.uid()
);

-- Obter o ID do agente recém criado
DO $$
DECLARE
    novo_agente_id uuid;
BEGIN
    -- Buscar o ID do agente recém criado
    SELECT id INTO novo_agente_id 
    FROM public.agentes_ia 
    WHERE nome = 'Pri' 
    AND empresa_id = get_user_active_company(auth.uid())
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- 2. Inserir cadência do agente
    INSERT INTO public.agente_cadencias (
      agente_id, gatilho_cadencia, ativo, timezone, dias_semana, 
      horario_fim, horario_inicio, intervalo_etapas_minutos, 
      delay_inicial_minutos, quantidade_etapas, empresa_id
    ) VALUES (
      novo_agente_id,
      'inatividade_cliente',
      true,
      'America/Sao_Paulo',
      '["segunda","terca","quarta","quinta","sexta","sabado","domingo"]'::jsonb,
      '18:00:00'::time,
      '09:00:00'::time,
      60,
      0,
      4,
      get_user_active_company(auth.uid())
    );
    
    -- 3. Inserir integração do agente
    INSERT INTO public.agente_integracoes (
      agente_id, ativo, webhook_metodo, empresa_id
    ) VALUES (
      novo_agente_id,
      true,
      'POST',
      get_user_active_company(auth.uid())
    );
    
    -- 4. Inserir follow-up do agente
    INSERT INTO public.agente_followups (
      agente_id, nome, descricao, tipo, webhook_url, ativo, empresa_id, criado_por,
      acoes
    ) VALUES (
      novo_agente_id,
      'DIspara Prospeção',
      'Enviar no body as seguintes informações: 

ID da empresa, Nome da Empresa, CRM ID da Empresa, ID da Prospecção, Título da Prospecção, descrição da prospecção, data de inicio, data de fim, local do evento, condições especiais, Nome do contato/touchpoint, telefone do contato/touchpoint, Status do contato,',
      'novo_contato_prospeccao',
      'https://automatemaiawh.sagadatadriven.com.br/webhook/disparo-pri',
      true,
      get_user_active_company(auth.uid()),
      auth.uid(),
      '{"tipo_evento": "novo_contato_prospeccao", "webhook_url": "https://automatemaiawh.sagadatadriven.com.br/webhook/disparo-pri"}'::jsonb
    );
END $$;
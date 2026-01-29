import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'Expected WebSocket connection' }), {
      status: 426,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get simulation config from query params
  const url = new URL(req.url);
  const personaName = url.searchParams.get('persona') || 'Lucas';
  const personaRole = url.searchParams.get('role') || 'Cliente interessado em veículo';
  const scenarioContext = url.searchParams.get('context') || 'Atendimento presencial em concessionária';
  const difficulty = url.searchParams.get('difficulty') || 'Médio';
  const voiceId = url.searchParams.get('voice') || 'shimmer';

  console.log(`Starting voice simulation - Persona: ${personaName}, Role: ${personaRole}, Difficulty: ${difficulty}, Voice: ${voiceId}`);

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', [
    'realtime',
    `openai-insecure-api-key.${OPENAI_API_KEY}`,
    'openai-beta.realtime-v1',
  ]);

  let sessionCreated = false;

  // Build system prompt based on persona - PORTUGUÊS BRASILEIRO OBRIGATÓRIO
  const systemPrompt = `Você é ${personaName}, ${personaRole}. 

IMPORTANTE: VOCÊ DEVE FALAR APENAS EM PORTUGUÊS BRASILEIRO. NUNCA USE INGLÊS OU QUALQUER OUTRO IDIOMA.

CONTEXTO DA SIMULAÇÃO:
${scenarioContext}

NÍVEL DE DIFICULDADE: ${difficulty}
${difficulty === 'Fácil' ? '- Seja receptivo e faça perguntas simples. Demonstre interesse genuíno e seja cooperativo.' : ''}
${difficulty === 'Médio' ? '- Faça algumas objeções moderadas sobre preço e condições. Peça mais informações antes de decidir. Mostre um pouco de resistência.' : ''}
${difficulty === 'Difícil' ? '- Seja cético e faça objeções fortes. Compare com concorrentes. Pressione por descontos significativos. Demonstre muita resistência e desconfiança.' : ''}

INSTRUÇÕES OBRIGATÓRIAS DE COMPORTAMENTO:
1. FALE SEMPRE EM PORTUGUÊS BRASILEIRO FLUENTE E NATURAL
2. Use expressões brasileiras comuns ("tá", "né", "beleza", "então", "bom", "olha")
3. Mantenha respostas curtas e naturais (1-3 frases no máximo)
4. Aja como um cliente brasileiro real, com sotaque e expressões regionais
5. Se o vendedor usar técnicas de venda eficazes, reaja positivamente mas com naturalidade
6. Se o vendedor for muito agressivo ou não ouvir, demonstre desconforto educadamente

EXEMPLOS DE RESPOSTAS EM PORTUGUÊS:
- "Olha, eu tô procurando um carro pra família, sabe?"
- "Hum, interessante... E o valor? Como fica?"
- "Tá, mas e se comparar com o da concorrência?"
- "Beleza, mas preciso pensar um pouco ainda."

PERGUNTAS QUE VOCÊ PODE FAZER:
- Quanto custa? Qual o preço à vista?
- Tem financiamento? Quais as condições?
- A garantia cobre o quê? Por quanto tempo?
- E o consumo? Faz quantos km por litro?
- Vocês aceitam meu carro usado na troca?

VOCÊ É O CLIENTE. Inicie a conversa de forma natural, como se estivesse entrando na loja ou atendendo uma ligação.

PRIMEIRA FALA: Cumprimente o vendedor de forma natural em português, como "Oi, boa tarde!" ou "Olá, tudo bem?".`;

  openaiWs.onopen = () => {
    console.log('Connected to OpenAI Realtime API');
  };

  openaiWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Log all events for debugging (not just type)
      if (data.type !== 'response.audio.delta') {
        console.log('OpenAI event:', data.type, data.error ? JSON.stringify(data.error) : '');
      } else {
        console.log('OpenAI event: response.audio.delta (audio chunk received)');
      }

      // Send session update after session.created
      if (data.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('Session created, sending configuration with Portuguese language...');
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: voiceId,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'pt', // FORÇA TRANSCRIÇÃO EM PORTUGUÊS
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000,
            },
            temperature: 0.7,
            max_response_output_tokens: 200,
          },
        };
        
        openaiWs.send(JSON.stringify(sessionUpdate));
        console.log('Session configuration sent with PT-BR language');
      }

      // After session is updated, trigger initial AI response
      if (data.type === 'session.updated') {
        console.log('Session updated, triggering AI to speak first...');
        
        // Create a conversation item with the AI speaking first
        const initialMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[Sistema: Você é o cliente. Inicie a conversa agora, cumprimentando o vendedor em português brasileiro. Diga algo como "Oi, boa tarde!" ou "Olá, tudo bem? Eu vim dar uma olhada nos carros..." - RESPONDA EM PORTUGUÊS]'
              }
            ]
          }
        };
        
        openaiWs.send(JSON.stringify(initialMessage));
        
        // Then trigger response
        setTimeout(() => {
          if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: 'response.create' }));
            console.log('Response.create sent');
          }
        }, 100);
      }

      // Forward relevant events to client
      if (clientSocket.readyState === WebSocket.OPEN) {
        const forwardEvents = [
          'session.created',
          'session.updated',
          'response.audio.delta',
          'response.audio.done',
          'response.audio_transcript.delta',
          'response.audio_transcript.done',
          'response.text.delta',
          'response.text.done',
          'response.done',
          'response.created',
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          'conversation.item.input_audio_transcription.completed',
          'conversation.item.created',
          'error',
        ];

        if (forwardEvents.includes(data.type)) {
          clientSocket.send(JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Error processing OpenAI message:', error);
    }
  };

  openaiWs.onerror = (error) => {
    console.error('OpenAI WebSocket error:', error);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ 
        type: 'error', 
        error: { message: 'OpenAI connection error' } 
      }));
    }
  };

  openaiWs.onclose = (event) => {
    console.log('OpenAI WebSocket closed:', event.code, event.reason);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
  };

  // Handle client messages
  clientSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Client event:', data.type);

      // Forward audio and control messages to OpenAI
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error processing client message:', error);
    }
  };

  clientSocket.onclose = () => {
    console.log('Client WebSocket closed');
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
  };

  return response;
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map voice to gender
const voiceGenderMap: Record<string, 'masculino' | 'feminino'> = {
  'shimmer': 'feminino',
  'alloy': 'feminino', 
  'nova': 'feminino',
  'echo': 'masculino',
  'fable': 'masculino',
  'onyx': 'masculino',
};

// Map gender to appropriate voices
const maleVoices = ['echo', 'fable', 'onyx'];
const femaleVoices = ['shimmer', 'alloy', 'nova'];

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
  const personaGender = url.searchParams.get('gender') || 'masculino';
  let requestedVoice = url.searchParams.get('voice') || 'echo';

  // Ensure voice matches gender - if mismatch, pick appropriate voice
  const voiceGender = voiceGenderMap[requestedVoice] || 'masculino';
  if (personaGender === 'masculino' && voiceGender === 'feminino') {
    requestedVoice = maleVoices[Math.floor(Math.random() * maleVoices.length)];
    console.log(`Voice mismatch: persona is male but voice was female. Changed to ${requestedVoice}`);
  } else if (personaGender === 'feminino' && voiceGender === 'masculino') {
    requestedVoice = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
    console.log(`Voice mismatch: persona is female but voice was male. Changed to ${requestedVoice}`);
  }

  console.log(`Starting voice simulation - Persona: ${personaName}, Gender: ${personaGender}, Role: ${personaRole}, Difficulty: ${difficulty}, Voice: ${requestedVoice}`);

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', [
    'realtime',
    `openai-insecure-api-key.${OPENAI_API_KEY}`,
    'openai-beta.realtime-v1',
  ]);

  let sessionCreated = false;

  // Build conversational system prompt - NATURAL CONVERSATION FLOW
  const systemPrompt = `# IDENTIDADE
Você é ${personaName}, ${personaRole}. Sexo: ${personaGender === 'masculino' ? 'Homem' : 'Mulher'}.

# CONTEXTO DA SIMULAÇÃO
${scenarioContext}

# NÍVEL DE DIFICULDADE: ${difficulty}
${difficulty === 'Fácil' ? 'Seja receptivo, faça perguntas simples e demonstre interesse genuíno.' : ''}
${difficulty === 'Médio' ? 'Faça objeções moderadas sobre preço e condições. Peça mais informações.' : ''}
${difficulty === 'Difícil' ? 'Seja cético, faça objeções fortes, compare com concorrentes, pressione por descontos.' : ''}

# REGRAS ABSOLUTAS DE COMPORTAMENTO

## FALA CURTA E NATURAL
- MÁXIMO 1-2 frases por vez
- Depois de falar, PARE e ESPERE o vendedor responder
- NÃO faça monólogos longos
- NÃO fale mais de 10 segundos seguidos

## ESCUTA ATIVA
- Quando o vendedor estiver falando, fique em SILÊNCIO
- Só responda quando o vendedor terminar
- Faça "hum", "tá", "entendi" para mostrar que está ouvindo

## CONVERSA NATURAL
- Fale como brasileiro normal, com expressões coloquiais
- Use: "tá", "né", "beleza", "olha", "então", "bom", "ah sim"
- NÃO seja formal demais
- NÃO use termos técnicos

## RITMO DE DIÁLOGO
- Faça UMA pergunta por vez
- Aguarde resposta
- Reaja à resposta
- Faça nova pergunta ou comentário

## EXEMPLOS DE FALAS CURTAS:
- "Oi, boa tarde!"
- "Olha, eu tô procurando um carro pra família."
- "Quanto fica esse aí?"
- "Hum, interessante... E o consumo?"
- "Tá, mas tem financiamento?"
- "Deixa eu pensar um pouco..."

# FLUXO DA CONVERSA

1. CUMPRIMENTO (1 frase só)
   "Oi, boa tarde!" ou "Olá!"

2. AGUARDE o vendedor falar

3. EXPLIQUE O QUE PROCURA (máximo 2 frases)
   "Então, eu tô procurando um carro. De preferência econômico."

4. AGUARDE resposta

5. FAÇA PERGUNTAS (uma por vez)
   - "Quanto custa?"
   - "Faz quantos km por litro?"
   - "Tem financiamento?"
   - "A garantia cobre o quê?"

6. REAJA às respostas
   - "Hum, interessante..."
   - "Tá, entendi."
   - "Ah sim..."

7. DEMONSTRE OBJEÇÕES (conforme dificuldade)
   - "Tá caro, não?"
   - "Na concorrência tá mais barato..."
   - "Preciso pensar..."

# VOCÊ É O CLIENTE
Você está RECEBENDO atendimento. O VENDEDOR (usuário) deve conduzir a venda.

# PRIMEIRA FALA
Diga apenas: "Oi, boa tarde!" e aguarde.`;

  openaiWs.onopen = () => {
    console.log('Connected to OpenAI Realtime API');
  };

  openaiWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Log events for debugging (except audio deltas which are frequent)
      if (data.type !== 'response.audio.delta') {
        console.log('OpenAI event:', data.type, data.error ? JSON.stringify(data.error) : '');
      }

      // Send session update after session.created
      if (data.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('Session created, sending configuration...');
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: requestedVoice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'pt',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.6,
              prefix_padding_ms: 500,
              silence_duration_ms: 800,
            },
            temperature: 0.8,
            max_response_output_tokens: 100, // Limit response length for short phrases
          },
        };
        
        openaiWs.send(JSON.stringify(sessionUpdate));
        console.log('Session configuration sent');
      }

      // After session is updated, trigger initial greeting
      if (data.type === 'session.updated') {
        console.log('Session updated, triggering initial greeting...');
        
        // Simple initial prompt to start conversation naturally
        const initialMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[O vendedor acabou de atender. Cumprimente com apenas "Oi, boa tarde!" e aguarde a resposta dele.]'
              }
            ]
          }
        };
        
        openaiWs.send(JSON.stringify(initialMessage));
        
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

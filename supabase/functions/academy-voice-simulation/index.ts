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

  console.log(`Starting voice simulation - Persona: ${personaName}, Role: ${personaRole}, Difficulty: ${difficulty}`);

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', [
    'realtime',
    `openai-insecure-api-key.${OPENAI_API_KEY}`,
    'openai-beta.realtime-v1',
  ]);

  let sessionCreated = false;

  // Build system prompt based on persona
  const systemPrompt = `Você é ${personaName}, ${personaRole}. 

CONTEXTO DA SIMULAÇÃO:
${scenarioContext}

NÍVEL DE DIFICULDADE: ${difficulty}
${difficulty === 'Fácil' ? '- Seja receptivo e faça perguntas simples. Demonstre interesse genuíno.' : ''}
${difficulty === 'Médio' ? '- Faça algumas objeções moderadas sobre preço e condições. Peça mais informações antes de decidir.' : ''}
${difficulty === 'Difícil' ? '- Seja cético e faça objeções fortes. Compare com concorrentes. Pressione por descontos. Demonstre resistência.' : ''}

INSTRUÇÕES DE COMPORTAMENTO:
- Responda sempre em português brasileiro
- Mantenha respostas curtas e naturais (1-3 frases)
- Aja como um cliente real, com dúvidas e objeções naturais
- Se o vendedor usar técnicas de venda eficazes (SPIN, rapport, etc.), reaja positivamente
- Se o vendedor for muito agressivo ou não ouvir, demonstre desconforto
- Faça perguntas sobre: preço, financiamento, garantia, consumo, valor de revenda, comparação com outros modelos

OBJETIVO:
Avaliar as habilidades do vendedor nas dimensões:
1. Situação - Faz perguntas para entender o contexto do cliente
2. Problema - Identifica as dores e necessidades
3. Implicação - Mostra as consequências de não resolver o problema
4. Negociação - Lida bem com objeções e negocia condições
5. Fechamento - Conduz para os próximos passos de forma natural

Lembre-se: você é o CLIENTE, não o vendedor. Aguarde o vendedor iniciar ou conduza a conversa como cliente faria.`;

  openaiWs.onopen = () => {
    console.log('Connected to OpenAI Realtime API');
  };

  openaiWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('OpenAI event:', data.type);

      // Send session update after session.created
      if (data.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('Session created, sending configuration...');
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: 'shimmer', // Brazilian Portuguese friendly voice
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
            },
            temperature: 0.8,
            max_response_output_tokens: 300,
          },
        };
        
        openaiWs.send(JSON.stringify(sessionUpdate));
        console.log('Session configuration sent');
      }

      // Forward relevant events to client
      if (clientSocket.readyState === WebSocket.OPEN) {
        // Forward these event types to the client
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
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          'conversation.item.input_audio_transcription.completed',
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

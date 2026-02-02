import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Voice gender mapping for OpenAI voices
const voiceGenderMap: Record<string, string> = {
  alloy: 'feminino',
  echo: 'masculino',
  fable: 'masculino',
  onyx: 'masculino',
  nova: 'feminino',
  shimmer: 'feminino',
  ash: 'masculino',
  ballad: 'masculino',
  coral: 'feminino',
  sage: 'feminino',
  verse: 'masculino',
};

const maleVoices = ['echo', 'fable', 'onyx', 'ash', 'ballad', 'verse'];
const femaleVoices = ['alloy', 'nova', 'shimmer', 'coral', 'sage'];

// Handle text chat action (for text simulations)
async function handleTextChat(body: any, OPENAI_API_KEY: string): Promise<Response> {
  const { system_prompt, messages, user_message } = body;

  const chatMessages = [
    { role: "system", content: system_prompt },
    ...messages,
    { role: "user", content: user_message },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: chatMessages,
      max_tokens: 150,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAI Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get AI response" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  const aiResponse = data.choices?.[0]?.message?.content || "...";

  return new Response(
    JSON.stringify({ response: aiResponse }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

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

  // Check for text chat action (non-WebSocket POST request)
  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    // Handle text chat for text simulations
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.action === 'text_chat') {
          return await handleTextChat(body, OPENAI_API_KEY);
        }
      } catch (e) {
        // Not a JSON body, continue to WebSocket error
      }
    }
    
    return new Response(JSON.stringify({ error: 'Expected WebSocket connection or text_chat action' }), {
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

  // Build conversational system prompt - ULTRA NATURAL VOICE UX
  const systemPrompt = `# QUEM VOCÊ É
${personaName}. ${personaGender === 'masculino' ? 'Homem' : 'Mulher'}. ${personaRole}.

# CONTEXTO
${scenarioContext}

# DIFICULDADE: ${difficulty}
${difficulty === 'Fácil' ? 'Receptivo, curioso, faz perguntas simples. Quer comprar, só precisa de um empurrãozinho.' : ''}
${difficulty === 'Médio' ? 'Interessado mas cauteloso. Questiona preço, pede mais detalhes, compara opções.' : ''}
${difficulty === 'Difícil' ? 'Cético e exigente. Objeções fortes, menciona concorrentes, pressiona desconto, não se convence fácil.' : ''}

# REGRAS DE VOZ (CRÍTICO!)

## 1. BREVIDADE EXTREMA
- MÁXIMO 1-2 frases curtas por turno
- Nunca ultrapasse 6 segundos de fala
- Depois de falar: SILÊNCIO. Espere.

## 2. FALE COMO GENTE
Você é brasileiro de verdade. Use:
- "Hm..." "Então..." "Olha..." "Ah..." "Bom..."
- "Tá", "né", "beleza", "pô", "cara"
- Pausas naturais entre ideias
- Variação de ritmo e energia

## 3. REAJA COM EMOÇÃO
- Se algo te interessa: "Opa! Isso me chamou atenção..."
- Se tem dúvida: "Hm... não sei não, viu..."
- Se gostou: "Ah, legal! Gostei disso."
- Se discorda: "Pô, mas sei lá..."
- Se pensando: "Deixa eu pensar... [pausa]"

## 4. ESCUTA ATIVA
Repita parte do que o vendedor disse:
- "Então você tá dizendo que..."
- "Ah, entendi, então o diferencial é..."
- "Hm, interessante isso de..."

## 5. NUNCA FAÇA
❌ Respostas longas ou explicativas
❌ Listar vários pontos de uma vez
❌ Falar de forma genérica ou robótica
❌ Terminar turnos sem emoção
❌ Ignorar o que o vendedor disse

# PADRÕES DE FALA

CUMPRIMENTO:
"Oi, boa tarde!"
(pausa, espera resposta)

INTERESSE:
"Hm... tô procurando um carro pra família, sabe?"

CURIOSIDADE:
"E aí, quanto fica esse daí?"

HESITAÇÃO:
"Ah... sei lá... tá meio caro, não?"

OBJEÇÃO:
"Pô, mas no concorrente vi mais barato, hein..."

PENSANDO:
"Deixa eu pensar um pouquinho..."

FECHANDO:
"Tá bom então... vamo conversar sobre isso."

# VOCÊ É CLIENTE
O vendedor conduz. Você reage, questiona, desafia.
Faça ele trabalhar pra te convencer.

# AGORA
Diga só: "Oi, boa tarde!" — e espere.`;

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
              threshold: 0.5, // Mais sensível para captar falas curtas
              prefix_padding_ms: 300, // Menos padding para respostas mais rápidas
              silence_duration_ms: 600, // Detecta fim de fala mais rápido
            },
            temperature: 0.9, // Mais variação e naturalidade
            max_response_output_tokens: 60, // Força respostas ultra curtas (~6 segundos)
          },
        };
        
        openaiWs.send(JSON.stringify(sessionUpdate));
        console.log('Session configuration sent with optimized voice UX settings');
      }

      // After session is updated, trigger initial greeting
      if (data.type === 'session.updated') {
        console.log('Session updated, triggering natural greeting...');
        
        // Trigger first response with natural energy
        const initialMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[Você acabou de entrar na loja. O vendedor te olha. Cumprimente de forma natural e breve - só "Oi, boa tarde!" - com energia leve e espere.]'
              }
            ]
          }
        };
        
        openaiWs.send(JSON.stringify(initialMessage));
        
        setTimeout(() => {
          if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: 'response.create' }));
            console.log('Initial greeting triggered');
          }
        }, 50); // Resposta mais rápida
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

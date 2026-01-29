import { useState, useRef, useCallback, useEffect } from 'react';
import { Persona, TrainingScenario, SimulationMessage } from '@/types/academy';
import { toast } from 'sonner';

interface UseVoiceSimulationProps {
  scenario: TrainingScenario;
  persona: Persona;
  onSessionEnd?: (messages: SimulationMessage[], duration: number) => void;
}

interface UseVoiceSimulationReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isAISpeaking: boolean;
  messages: SimulationMessage[];
  duration: number;
  partialTranscript: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

// Audio utilities
const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = int16Data.byteLength;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
  wavArray.set(new Uint8Array(wavHeader), 0);
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);

  return wavArray;
};

// Audio Queue for sequential playback
class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;
  private onPlayingChange: (playing: boolean) => void;

  constructor(audioContext: AudioContext, onPlayingChange: (playing: boolean) => void) {
    this.audioContext = audioContext;
    this.onPlayingChange = onPlayingChange;
  }

  async addToQueue(audioData: Uint8Array) {
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onPlayingChange(false);
      return;
    }

    this.isPlaying = true;
    this.onPlayingChange(true);
    const audioData = this.queue.shift()!;

    try {
      const wavData = createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer.slice(0) as ArrayBuffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => this.playNext();
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
  }
}

export function useVoiceSimulation({ scenario, persona, onSessionEnd }: UseVoiceSimulationProps): UseVoiceSimulationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [duration, setDuration] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentAITranscriptRef = useRef<string>('');
  const currentUserTranscriptRef = useRef<string>('');

  // Duration timer
  useEffect(() => {
    if (isConnected) {
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isConnected]);

  const addMessage = useCallback((role: 'user' | 'ai', content: string) => {
    const message: SimulationMessage = {
      id: crypto.randomUUID(),
      session_id: 'current',
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    console.log('Starting voice simulation connection...');

    try {
      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioQueueRef.current = new AudioQueue(audioContextRef.current, setIsAISpeaking);

      // Get microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Build WebSocket URL with params
      const wsUrl = new URL(`wss://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/academy-voice-simulation`);
      wsUrl.searchParams.set('persona', persona.name);
      wsUrl.searchParams.set('role', persona.role);
      wsUrl.searchParams.set('context', scenario.description);
      wsUrl.searchParams.set('difficulty', persona.difficulty);

      console.log('Connecting to:', wsUrl.toString());
      wsRef.current = new WebSocket(wsUrl.toString());

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);

        // Set up audio capture
        if (audioContextRef.current && streamRef.current) {
          sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
          processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

          processorRef.current.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN && !isMuted) {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Audio = encodeAudioForAPI(new Float32Array(inputData));
              wsRef.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: base64Audio,
              }));
            }
          };

          sourceRef.current.connect(processorRef.current);
          processorRef.current.connect(audioContextRef.current.destination);
        }

        toast.success('Simulação iniciada! Fale com o cliente.');
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received event:', data.type);

          switch (data.type) {
            case 'response.audio.delta':
              // Decode and queue audio
              if (data.delta && audioQueueRef.current) {
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                await audioQueueRef.current.addToQueue(bytes);
              }
              break;

            case 'response.audio_transcript.delta':
              // AI transcript partial
              currentAITranscriptRef.current += data.delta || '';
              setPartialTranscript(currentAITranscriptRef.current);
              break;

            case 'response.audio_transcript.done':
            case 'response.done':
              // Finalize AI message
              if (currentAITranscriptRef.current.trim()) {
                addMessage('ai', currentAITranscriptRef.current.trim());
                currentAITranscriptRef.current = '';
                setPartialTranscript('');
              }
              break;

            case 'conversation.item.input_audio_transcription.completed':
              // User speech transcribed
              if (data.transcript?.trim()) {
                addMessage('user', data.transcript.trim());
              }
              break;

            case 'input_audio_buffer.speech_started':
              console.log('User started speaking');
              break;

            case 'input_audio_buffer.speech_stopped':
              console.log('User stopped speaking');
              break;

            case 'error':
              console.error('OpenAI error:', data.error);
              toast.error(data.error?.message || 'Erro na simulação');
              break;
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Erro de conexão');
        setIsConnecting(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
      };

    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Erro ao iniciar simulação. Verifique as permissões do microfone.');
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting, persona, scenario, isMuted, addMessage]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting voice simulation...');

    // Stop audio capture
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear audio queue
    if (audioQueueRef.current) {
      audioQueueRef.current.clear();
      audioQueueRef.current = null;
    }

    // Notify session end
    if (onSessionEnd) {
      onSessionEnd(messages, duration);
    }

    setIsConnected(false);
    setIsAISpeaking(false);
  }, [messages, duration, onSessionEnd]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isAISpeaking,
    messages,
    duration,
    partialTranscript,
    connect,
    disconnect,
    toggleMute,
  };
}

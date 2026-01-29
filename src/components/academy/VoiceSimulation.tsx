import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { TrainingScenario, Persona, SimulationMessage } from "@/types/academy";
import { cn } from "@/lib/utils";
import { useVoiceSimulation } from "@/hooks/useVoiceSimulation";

interface VoiceSimulationProps {
  scenario: TrainingScenario;
  persona: Persona;
  onEnd: () => void;
}

export function VoiceSimulation({ scenario, persona, onEnd }: VoiceSimulationProps) {
  const {
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
  } = useVoiceSimulation({
    scenario,
    persona,
    onSessionEnd: (msgs, dur) => {
      console.log('Session ended:', msgs.length, 'messages,', dur, 'seconds');
    },
  });

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    disconnect();
    onEnd();
  };

  return (
    <div className="h-full flex">
      {/* Main Video/Avatar Area */}
      <div className="flex-1 relative bg-gradient-to-b from-muted to-muted/50">
        {/* Status indicator */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {isConnecting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                <span className="text-sm font-medium">Conectando...</span>
              </>
            ) : isConnected ? (
              <>
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  isAISpeaking ? "bg-blue-500 animate-pulse" : "bg-green-500 animate-pulse"
                )} />
                <span className="text-sm font-medium">
                  {isAISpeaking ? "IA falando..." : "Em chamada"}
                </span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Desconectado</span>
              </>
            )}
          </div>
        </div>

        {/* Avatar/Video placeholder */}
        <div className="h-full flex items-center justify-center">
          <div className="relative">
            <div className={cn(
              "w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300",
              isAISpeaking 
                ? "bg-gradient-to-br from-primary/40 to-primary/20 ring-4 ring-primary/50 ring-offset-4 ring-offset-background" 
                : "bg-gradient-to-br from-primary/20 to-primary/5"
            )}>
              <Avatar className="h-48 w-48">
                <AvatarFallback className="text-6xl bg-primary/10 text-primary">
                  {persona.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <Badge variant="secondary" className="bg-background shadow-md">
                {persona.name} - {persona.difficulty}
              </Badge>
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            disabled={!isConnected}
            className={cn(
              "h-14 w-14 rounded-full transition-colors",
              isMuted && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={handleEndCall}
            size="lg"
            disabled={isConnecting}
            className="h-14 px-8 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Encerrar Chamada
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            <Volume2 className="h-6 w-6" />
          </Button>
        </div>

        {/* Duration */}
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="text-lg font-mono">
            {formatDuration(duration)}
          </Badge>
        </div>
      </div>

      {/* Right Panel - Instructions & Transcription */}
      <div className="w-96 border-l border-border bg-card flex flex-col">
        {/* Instructions */}
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide mb-3">
            Instruções
          </h3>
          <p className="text-sm text-muted-foreground">
            Você está participando de uma simulação de atendimento presencial na loja da Saga.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            O cliente foi atendido por telefone, demonstrou interesse em um veículo específico e compareceu à loja para conhecer o carro pessoalmente, tirar dúvidas e, eventualmente, avançar na negociação.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Seu objetivo</strong> é conduzir um bom atendimento, esclarecer as dúvidas do cliente sobre valor, estado do carro, financiamento e negociação, e tentar avançar para uma proposta formal.
          </p>
        </div>

        {/* Transcription */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide mb-3">
            Transcrição
          </h3>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "ai" && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {persona.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {message.content}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      EU
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Partial transcript (AI currently speaking) */}
            {partialTranscript && (
              <div className="flex gap-3 justify-start opacity-70">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {persona.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-muted text-foreground rounded-bl-sm">
                  {partialTranscript}
                  <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && !partialTranscript && isConnected && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Aguardando você iniciar a conversa...
              </p>
            )}

            {/* Connecting state */}
            {isConnecting && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Conectando à simulação...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

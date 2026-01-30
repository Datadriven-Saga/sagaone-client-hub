import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2, Target, User, Clock } from "lucide-react";
import { TrainingScenario, Persona, SimulationMessage } from "@/types/academy";
import { cn } from "@/lib/utils";
import { useVoiceSimulation } from "@/hooks/useVoiceSimulation";

interface VoiceSimulationProps {
  scenario: TrainingScenario;
  persona: Persona;
  onEnd: () => void;
  onSessionData?: (messages: SimulationMessage[], duration: number) => void;
}

export function VoiceSimulation({ scenario, persona, onEnd, onSessionData }: VoiceSimulationProps) {
  const disconnectRef = useRef<() => void>(() => {});
  const messagesRef = useRef<SimulationMessage[]>([]);
  const durationRef = useRef<number>(0);
  
  const {
    isConnected,
    isConnecting,
    isMuted,
    isAISpeaking,
    messages,
    duration,
    partialTranscript,
    volume,
    connect,
    disconnect,
    toggleMute,
    setVolume,
  } = useVoiceSimulation({
    scenario,
    persona,
    onSessionEnd: (msgs, dur) => {
      console.log('Session ended:', msgs.length, 'messages,', dur, 'seconds');
      // Store final data
      messagesRef.current = msgs;
      durationRef.current = dur;
      // Notify parent
      if (onSessionData) {
        onSessionData(msgs, dur);
      }
    },
  });

  // Keep messages and duration refs updated
  useEffect(() => {
    messagesRef.current = messages;
    durationRef.current = duration;
  }, [messages, duration]);

  // Keep disconnect ref updated
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // Auto-connect on mount and cleanup on unmount
  useEffect(() => {
    connect();
    
    return () => {
      console.log('VoiceSimulation component unmounting - calling disconnect');
      disconnectRef.current();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    // Notify parent with current data before disconnecting
    if (onSessionData) {
      onSessionData(messagesRef.current, durationRef.current);
    }
    disconnect();
    onEnd();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Médio":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Difícil":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Main Call Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isConnecting ? "bg-amber-500 animate-pulse" : 
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
            <span className="text-sm font-medium text-foreground">
              {isConnecting ? "Conectando..." : isConnected ? (isAISpeaking ? "IA falando..." : "Em chamada") : "Desconectado"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Avatar Area */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-muted/30 to-muted/50">
          <div className="text-center">
            <div className="relative inline-block">
              <div className={cn(
                "w-48 h-48 md:w-56 md:h-56 rounded-full flex items-center justify-center transition-all duration-300",
                isAISpeaking 
                  ? "bg-sagaone-login-card/20 ring-4 ring-sagaone-login-card/40 ring-offset-4 ring-offset-background" 
                  : "bg-sagaone-primary/10"
              )}>
                <Avatar className="h-40 w-40 md:h-48 md:w-48">
                  <AvatarFallback className="text-5xl md:text-6xl bg-sagaone-primary text-primary-foreground">
                    {persona.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {isAISpeaking && (
                <div className="absolute inset-0 rounded-full animate-ping bg-sagaone-login-card/20" style={{ animationDuration: '1.5s' }} />
              )}
            </div>
            <h2 className="mt-6 text-2xl font-bold text-foreground">{persona.name}</h2>
            <p className="text-muted-foreground mt-1">{persona.role}</p>
            <Badge variant="outline" className={cn("mt-3", getDifficultyColor(persona.difficulty))}>
              {persona.difficulty}
            </Badge>
          </div>
        </div>

        {/* Call Controls */}
        <div className="h-28 border-t border-border bg-card flex items-center justify-center gap-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleMute}
                  disabled={!isConnected}
                  className={cn(
                    "h-14 w-14 rounded-full transition-all",
                    isMuted && "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive"
                  )}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isMuted ? "Ativar microfone" : "Desativar microfone (mutar)"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleEndCall}
                  size="lg"
                  disabled={isConnecting}
                  className="h-14 px-10 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                >
                  <PhoneOff className="h-5 w-5" />
                  Encerrar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Encerrar a simulação de chamada</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 rounded-full"
                    >
                      {volume === 0 ? (
                        <VolumeX className="h-6 w-6" />
                      ) : (
                        <Volume2 className="h-6 w-6" />
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Volume do áudio da IA</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent side="top" className="w-48 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Volume</span>
                  <span className="text-sm text-muted-foreground">{Math.round(volume * 100)}%</span>
                </div>
                <Slider
                  value={[volume * 100]}
                  onValueChange={([val]) => setVolume(val / 100)}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVolume(0)}
                    className="text-xs"
                  >
                    Mudo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVolume(1)}
                    className="text-xs"
                  >
                    100%
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Right Panel - Details & Transcription */}
      <div className="w-96 border-l border-border bg-card flex flex-col">
        {/* Scenario Details */}
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-sagaone-login-card" />
            Detalhes da Simulação
          </h3>
          
          <Card className="p-4 bg-muted/30 border-0">
            <p className="text-sm font-medium text-foreground mb-2">{scenario.title}</p>
            <p className="text-xs text-muted-foreground">
              Você está participando de uma simulação de atendimento na loja da Saga.
            </p>
            {persona.description && (
              <p className="text-xs text-muted-foreground mt-2">
                {persona.description}
              </p>
            )}
            {persona.objective && (
              <div className="mt-3 p-2 rounded-lg bg-sagaone-login-card/10">
                <p className="text-xs text-sagaone-login-card font-medium">
                  Objetivo: {persona.objective}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Transcription */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-5 pb-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="h-4 w-4 text-sagaone-login-card" />
              Transcrição
            </h3>
          </div>
          
          <ScrollArea className="flex-1 px-5 pb-5">
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
                      <AvatarFallback className="text-xs bg-sagaone-primary text-primary-foreground">
                        {persona.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "bg-sagaone-login-card text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {message.content}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-sagaone-login-card text-white">
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
                    <AvatarFallback className="text-xs bg-sagaone-primary text-primary-foreground">
                      {persona.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground rounded-bl-md">
                    {partialTranscript}
                    <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-1" />
                  </div>
                </div>
              )}

              {/* Empty state */}
              {messages.length === 0 && !partialTranscript && isConnected && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                    <Mic className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aguardando você iniciar a conversa...
                  </p>
                </div>
              )}

              {/* Connecting state */}
              {isConnecting && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Conectando à simulação...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

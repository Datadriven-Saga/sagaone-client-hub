import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { TrainingScenario, Persona, SimulationMessage } from "@/types/academy";
import { cn } from "@/lib/utils";

interface VoiceSimulationProps {
  scenario: TrainingScenario;
  persona: Persona;
  onEnd: () => void;
}

// Mock messages for demonstration
const mockMessages: SimulationMessage[] = [
  {
    id: "1",
    session_id: "demo",
    role: "ai",
    content: "Olá. Sou o Lucas. Eu falei pelo telefone com alguém e agendei 1 visita.",
    timestamp: new Date().toISOString(),
  },
  {
    id: "2",
    session_id: "demo",
    role: "user",
    content: "Oi Lucas, tudo bem? Eu sou o Rafael posso te atender aqui hoje então é o que tu procura?",
    timestamp: new Date().toISOString(),
  },
  {
    id: "3",
    session_id: "demo",
    role: "ai",
    content: "Tudo bem sim, vim ver o Compass Longitude, aquele 1.3 turbo que vi no site de vocês,",
    timestamp: new Date().toISOString(),
  },
  {
    id: "4",
    session_id: "demo",
    role: "user",
    content: "Ah perfeito, claro consigo te mostrar aqui o carro para tu como é que ele é, tirar suas dúvidas. Tu está querendo trocar de carro? Tu já tem 1 carro hoje?",
    timestamp: new Date().toISOString(),
  },
];

export function VoiceSimulation({ scenario, persona, onEnd }: VoiceSimulationProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<SimulationMessage[]>(mockMessages);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex">
      {/* Main Video/Avatar Area */}
      <div className="flex-1 relative bg-gradient-to-b from-muted to-muted/50">
        {/* Status indicator */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Em chamada</span>
          </div>
        </div>

        {/* Avatar/Video placeholder */}
        <div className="h-full flex items-center justify-center">
          <div className="relative">
            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
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
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "h-14 w-14 rounded-full",
              isMuted && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={onEnd}
            size="lg"
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
                      AU
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  PhoneOff, 
  Target, 
  User, 
  Clock, 
  Loader2,
  MessageSquare 
} from "lucide-react";
import { TrainingScenario, Persona, SimulationMessage } from "@/types/academy";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TextSimulationProps {
  scenario: TrainingScenario;
  persona: Persona;
  onEnd: () => void;
  onSessionData?: (messages: SimulationMessage[], duration: number) => void;
}

export function TextSimulation({ scenario, persona, onEnd, onSessionData }: TextSimulationProps) {
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const messagesRef = useRef<SimulationMessage[]>([]);

  // Keep messages ref updated
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize with AI greeting
  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      try {
        // Get session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sessão não encontrada");
        }

        // Build system prompt for text simulation
        const systemPrompt = buildSystemPrompt();

        // Get initial greeting from AI
        const response = await supabase.functions.invoke("academy-voice-simulation", {
          body: {
            action: "text_chat",
            system_prompt: systemPrompt,
            messages: [],
            user_message: "[INÍCIO DA CONVERSA - Cumprimente o vendedor brevemente como se estivesse iniciando uma conversa no WhatsApp]",
          },
        });

        if (response.error) throw response.error;

        const aiMessage: SimulationMessage = {
          id: crypto.randomUUID(),
          session_id: "",
          role: "ai",
          content: response.data?.response || "Olá! Como posso ajudar?",
          timestamp: new Date().toISOString(),
        };

        setMessages([aiMessage]);
        setIsConnected(true);
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast.error("Erro ao iniciar simulação de texto");
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildSystemPrompt = () => {
    const cenario = (scenario as any).cenario || {};
    
    return `Você é ${persona.name}, ${persona.role} da empresa ${persona.company}.

CONTEXTO DA SIMULAÇÃO:
${cenario.contexto || scenario.description || "Simulação de atendimento via WhatsApp."}

OBJETIVO DO CLIENTE:
${persona.objective || cenario.objetivo || "Interagir de forma realista em uma conversa de vendas."}

PERFIL DO PERSONAGEM:
${persona.description || "Cliente interessado em produtos/serviços."}

REGRAS DE COMPORTAMENTO:
1. Responda SEMPRE em português brasileiro coloquial
2. Use linguagem de WhatsApp: mensagens curtas, informais, com emojis ocasionais
3. Máximo de 2-3 frases por mensagem (estilo chat)
4. Seja natural e realista, como uma pessoa real conversando
5. Faça objeções e perguntas típicas de um cliente real
6. Reaja emocionalmente ao que o vendedor diz
7. Use hesitações naturais: "hm...", "então...", "olha..."
8. Demonstre escuta ativa repetindo partes do que foi dito
9. NUNCA revele que é uma IA ou simulação
10. Dificuldade: ${persona.difficulty} - ${
      persona.difficulty === "Fácil" 
        ? "seja receptivo e fácil de convencer" 
        : persona.difficulty === "Difícil" 
        ? "seja muito exigente, faça várias objeções e seja difícil de convencer"
        : "tenha algumas objeções mas esteja aberto a ouvir"
    }

IMPORTANTE: Você está simulando uma conversa de WhatsApp. Seja breve e natural.`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: SimulationMessage = {
      id: crypto.randomUUID(),
      session_id: "",
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt();
      
      // Build conversation history
      const conversationHistory = [...messagesRef.current, userMessage].map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const response = await supabase.functions.invoke("academy-voice-simulation", {
        body: {
          action: "text_chat",
          system_prompt: systemPrompt,
          messages: conversationHistory.slice(-10), // Last 10 messages for context
          user_message: userMessage.content,
        },
      });

      if (response.error) throw response.error;

      const aiMessage: SimulationMessage = {
        id: crypto.randomUUID(),
        session_id: "",
        role: "ai",
        content: response.data?.response || "...",
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEndChat = () => {
    if (onSessionData) {
      onSessionData(messagesRef.current, duration);
    }
    onEnd();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-sagaone-primary text-primary-foreground">
                {persona.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">{persona.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {isConnected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Online
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    Conectando...
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium text-foreground">
                {formatDuration(duration)}
              </span>
            </div>
            <Button
              onClick={handleEndChat}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <PhoneOff className="h-4 w-4" />
              Encerrar
            </Button>
          </div>
        </div>

        {/* Chat Messages - WhatsApp Style */}
        <div 
          className="flex-1 overflow-y-auto p-4 bg-[url('/placeholder.svg')] bg-repeat bg-opacity-5"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
          }}
          ref={scrollRef}
        >
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-4 py-2 shadow-sm",
                    message.role === "user"
                      ? "bg-[#dcf8c6] dark:bg-emerald-900/50 text-foreground rounded-br-none"
                      : "bg-card text-foreground rounded-bl-none"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1 text-right",
                    message.role === "user" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                  )}>
                    {new Date(message.timestamp).toLocaleTimeString("pt-BR", { 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card rounded-lg px-4 py-3 shadow-sm rounded-bl-none">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Initial loading */}
            {messages.length === 0 && isLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Iniciando conversa...</span>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] max-h-32 resize-none rounded-xl bg-muted/50"
              rows={1}
              disabled={isLoading || !isConnected}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || !isConnected}
              size="icon"
              className="h-11 w-11 rounded-full bg-sagaone-primary hover:bg-sagaone-primary/90 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="w-80 border-l border-border bg-card flex flex-col">
        {/* Persona Details */}
        <div className="p-5 border-b border-border text-center">
          <Avatar className="h-20 w-20 mx-auto mb-3">
            <AvatarFallback className="text-2xl bg-sagaone-primary text-primary-foreground">
              {persona.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-foreground">{persona.name}</h3>
          <p className="text-sm text-muted-foreground">{persona.role}</p>
          <p className="text-xs text-muted-foreground">{persona.company}</p>
          <Badge variant="outline" className={cn("mt-3", getDifficultyColor(persona.difficulty))}>
            {persona.difficulty}
          </Badge>
        </div>

        {/* Scenario Details */}
        <div className="p-5 flex-1">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-sagaone-login-card" />
            Detalhes da Simulação
          </h3>
          
          <Card className="p-4 bg-muted/30 border-0">
            <p className="text-sm font-medium text-foreground mb-2">{scenario.title}</p>
            <p className="text-xs text-muted-foreground">
              Simulação de atendimento via chat/WhatsApp.
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

          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Simulação por Texto</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Converse como se estivesse no WhatsApp. Use linguagem natural e informal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

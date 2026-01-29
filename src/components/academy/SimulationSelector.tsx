import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, MessageSquare, Phone } from "lucide-react";
import { TrainingScenario, Persona, SimulationType } from "@/types/academy";
import { cn } from "@/lib/utils";
import { useAcademySimulacoes } from "@/hooks/useAcademyData";

interface SimulationSelectorProps {
  type: SimulationType;
  onStartSimulation: (scenario: TrainingScenario, persona: Persona) => void;
}

// Transform database simulacao to TrainingScenario format
function transformToScenario(simulacao: any): TrainingScenario {
  const cenario = simulacao.cenario || {};
  const personas: Persona[] = (cenario.personas || []).map((p: any) => ({
    id: p.id || crypto.randomUUID(),
    name: p.nome || p.name || "Persona",
    role: p.cargo || p.role || "Cliente",
    company: p.empresa || p.company || "Empresa",
    difficulty: p.dificuldade || p.difficulty || "Médio",
    description: p.descricao || p.description || "",
    objective: p.objetivo || p.objective || "",
    avatar: p.avatar,
  }));

  return {
    id: simulacao.id,
    title: simulacao.titulo,
    description: simulacao.descricao || "",
    department: cenario.departamento || "Vendas Novos",
    type: simulacao.tipo === "simulacao_voz" ? "voice" : "text",
    language: cenario.idioma || "Português",
    personas,
  };
}

// Fallback mock scenarios
const mockScenarios: TrainingScenario[] = [
  {
    id: "mock-1",
    title: "Atendimento Veículo Novo",
    description: "Simulação de venda de veículo novo em showroom",
    department: "Vendas Novos",
    type: "voice",
    language: "Português",
    personas: [
      {
        id: "p1",
        name: "Lucas",
        role: "Gerente comercial",
        company: "Shopping ACME",
        difficulty: "Médio",
        description: "Cliente interessado em Compass",
        objective: "Conhecer o veículo e tirar dúvidas sobre financiamento",
      },
      {
        id: "p2",
        name: "Marina",
        role: "Empresária",
        company: "Tech Solutions",
        difficulty: "Difícil",
        description: "Cliente exigente buscando SUV premium",
        objective: "Comparar modelos e negociar preço",
      },
    ],
  },
  {
    id: "mock-2",
    title: "Diagnóstico - Pós-Venda",
    description: "Atendimento de cliente na oficina",
    department: "Pós-Venda",
    type: "voice",
    language: "Português",
    personas: [
      {
        id: "p3",
        name: "Carlos",
        role: "Engenheiro",
        company: "Construtora ABC",
        difficulty: "Fácil",
        description: "Cliente levando carro para revisão programada",
        objective: "Realizar revisão e verificar possíveis manutenções adicionais",
      },
    ],
  },
];

export function SimulationSelector({ type, onStartSimulation }: SimulationSelectorProps) {
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  const dbType = type === "voice" ? "simulacao_voz" : "simulacao_texto";
  const { data: simulacoes, isLoading } = useAcademySimulacoes(dbType);

  // Transform database data to scenarios
  const dbScenarios = simulacoes?.map(transformToScenario) || [];
  
  // Use mock data if no database scenarios
  const scenarios = dbScenarios.length > 0 
    ? dbScenarios 
    : mockScenarios.filter((s) => s.type === type);

  const isVoice = type === "voice";

  const handleStartSimulation = () => {
    if (selectedScenario && selectedPersona) {
      onStartSimulation(selectedScenario, selectedPersona);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Médio":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Difícil":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6">
        {isVoice ? "Simulações por Voz" : "Simulações por Texto"}
      </h1>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="p-6"><Skeleton className="h-48 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-48 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-48 w-full" /></Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Scenario Selection */}
          <Card className="p-4 md:p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Selecione a simulação que deseja praticar.
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {scenarios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma simulação disponível. Entre em contato com seu gestor.
                </p>
              ) : (
                scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenario(scenario);
                      setSelectedPersona(null);
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-colors",
                      selectedScenario?.id === scenario.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <p className="font-medium text-foreground">{scenario.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{scenario.description || scenario.language}</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {scenario.personas.length} persona{scenario.personas.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Persona Selection */}
          <Card className="p-4 md:p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Selecione o personagem que deseja praticar.
            </h3>
            {selectedScenario?.personas && selectedScenario.personas.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedScenario.personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-colors",
                      selectedPersona?.id === persona.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {persona.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{persona.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {persona.role} @ {persona.company}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={cn("mt-2 text-xs", getDifficultyColor(persona.difficulty))}
                        >
                          {persona.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {selectedScenario 
                  ? "Nenhum personagem disponível para esta simulação." 
                  : "Selecione uma simulação primeiro."}
              </p>
            )}
          </Card>

          {/* Meeting Details */}
          <Card className="p-4 md:p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Detalhes da simulação
            </h3>
            {selectedPersona ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Instruções</h4>
                  <p className="text-sm text-muted-foreground">
                    Você está participando de uma simulação de atendimento {isVoice ? "por voz" : "por texto"} na loja da Saga.
                  </p>
                  {selectedPersona.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedPersona.description}
                    </p>
                  )}
                  {selectedPersona.objective && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <strong>Seu objetivo:</strong> {selectedPersona.objective}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedPersona.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{selectedPersona.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedPersona.role} @ {selectedPersona.company}
                    </p>
                    <Badge 
                      variant="outline" 
                      className={cn("mt-1 text-xs", getDifficultyColor(selectedPersona.difficulty))}
                    >
                      {selectedPersona.difficulty}
                    </Badge>
                  </div>
                </div>

                <Button 
                  onClick={handleStartSimulation}
                  className="w-full gap-2 bg-primary hover:bg-primary/90"
                >
                  {isVoice ? <Phone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  {isVoice ? "Iniciar chamada" : "Iniciar conversa"}
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  {isVoice ? <Mic className="h-8 w-8 text-muted-foreground" /> : <MessageSquare className="h-8 w-8 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecione uma simulação e um personagem para ver os detalhes.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

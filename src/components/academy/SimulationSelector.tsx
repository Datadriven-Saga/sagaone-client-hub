import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MessageSquare, Phone } from "lucide-react";
import { TrainingScenario, Persona, SimulationType } from "@/types/academy";
import { cn } from "@/lib/utils";

// Mock scenarios for dealership
const mockScenarios: TrainingScenario[] = [
  {
    id: "1",
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
    id: "2",
    title: "Diagnóstico - Pós-Venda",
    description: "Atendimento de cliente na oficina",
    department: "Pós-Venda",
    type: "voice",
    language: "Português",
    personas: [],
  },
  {
    id: "3",
    title: "Feedback 1:1",
    description: "Reunião de feedback com colaborador",
    department: "Vendas Novos",
    type: "voice",
    language: "Português",
    personas: [],
  },
  {
    id: "4",
    title: "Outbound - Prospecção",
    description: "Ligação ativa para prospecção",
    department: "Vendas Novos",
    type: "voice",
    language: "Português",
    personas: [],
  },
  {
    id: "5",
    title: "Venda de Seguros",
    description: "Oferta de seguro automotivo",
    department: "F&I",
    type: "voice",
    language: "Português",
    personas: [],
  },
  {
    id: "6",
    title: "Agendamento de Revisão",
    description: "Ligação para agendar revisão",
    department: "Pós-Venda",
    type: "voice",
    language: "Português",
    personas: [],
  },
];

interface SimulationSelectorProps {
  type: SimulationType;
  onStartSimulation: (scenario: TrainingScenario, persona: Persona) => void;
}

export function SimulationSelector({ type, onStartSimulation }: SimulationSelectorProps) {
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  const scenarios = mockScenarios.filter((s) => s.type === type);
  const isVoice = type === "voice";

  const handleStartSimulation = () => {
    if (selectedScenario && selectedPersona) {
      onStartSimulation(selectedScenario, selectedPersona);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-green-100 text-green-700";
      case "Médio":
        return "bg-yellow-100 text-yellow-700";
      case "Difícil":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">
        {isVoice ? "Simulações por Voz" : "Simulações por Texto"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Selection */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Selecione a simulação que deseja praticar.
          </h3>
          <div className="space-y-2">
            {scenarios.map((scenario) => (
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
                <p className="text-sm text-muted-foreground">{scenario.language}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Persona Selection */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Selecione o personagem que deseja praticar.
          </h3>
          {selectedScenario?.personas && selectedScenario.personas.length > 0 ? (
            <div className="space-y-3">
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
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {persona.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{persona.name}</p>
                        <Badge variant="outline" className="text-xs">
                          3.0/10
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              {selectedScenario 
                ? "Nenhum personagem disponível para esta simulação." 
                : "Selecione uma simulação primeiro."}
            </p>
          )}
        </Card>

        {/* Meeting Details */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Detalhes da simulação
          </h3>
          {selectedPersona ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Instruções</h4>
                <p className="text-sm text-muted-foreground">
                  Você está participando de uma simulação de atendimento presencial na loja da Saga.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedPersona.description}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Seu objetivo:</strong> {selectedPersona.objective}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedPersona.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedPersona.name}</p>
                  <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              Selecione uma simulação e um personagem para ver os detalhes.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

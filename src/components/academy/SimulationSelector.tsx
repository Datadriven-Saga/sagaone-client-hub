import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mic, MessageSquare, Phone, Users, Target, ChevronRight, Sparkles } from "lucide-react";
import { TrainingScenario, Persona, SimulationType } from "@/types/academy";
import { cn } from "@/lib/utils";
import { useAcademySimulacoes } from "@/hooks/useAcademyData";
import { AcademyPageHeader } from "./AcademyPageHeader";

interface SimulationSelectorProps {
  type: SimulationType;
  onStartSimulation: (scenario: TrainingScenario, persona: Persona) => void;
}

// Transform database simulacao to TrainingScenario format
function transformToScenario(simulacao: any): TrainingScenario {
  const cenario = simulacao.cenario || {};
  const configVoz = simulacao.config_voz || {};
  
  const personas: Persona[] = (cenario.personas || []).map((p: any) => ({
    id: p.id || crypto.randomUUID(),
    name: p.nome || p.name || "Persona",
    role: p.cargo || p.role || "Cliente",
    company: p.empresa || p.company || "Empresa",
    difficulty: p.dificuldade || p.difficulty || "Médio",
    description: p.descricao || p.description || "",
    objective: p.objetivo || p.objective || "",
    avatar: p.avatar,
    voice: configVoz.voice || p.voice || "shimmer", // OpenAI voice ID
  }));

  return {
    id: simulacao.id,
    title: simulacao.titulo,
    description: simulacao.descricao || "",
    department: cenario.departamento || "Vendas Novos",
    type: simulacao.tipo === "voz" ? "voice" : "text",
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // DB constraint: tipo is 'voz' or 'texto'
  const dbType = type === "voice" ? "voz" : "texto";
  const { data: simulacoes, isLoading } = useAcademySimulacoes(dbType);

  // Transform database data to scenarios
  const dbScenarios = simulacoes?.map(transformToScenario) || [];
  
  // Use mock data if no database scenarios
  const scenarios = dbScenarios.length > 0 
    ? dbScenarios 
    : mockScenarios.filter((s) => s.type === type);

  const isVoice = type === "voice";

  const handleScenarioClick = (scenario: TrainingScenario) => {
    setSelectedScenario(scenario);
    setIsModalOpen(true);
  };

  const handlePersonaSelect = (persona: Persona) => {
    if (selectedScenario) {
      setIsModalOpen(false);
      onStartSimulation(selectedScenario, persona);
    }
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

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "🟢";
      case "Médio":
        return "🟡";
      case "Difícil":
        return "🔴";
      default:
        return "⚪";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <AcademyPageHeader
        title={isVoice ? "Simulações por Voz" : "Simulações por Texto"}
        description="Selecione um cenário para iniciar sua prática. Cada simulação possui personagens com diferentes níveis de dificuldade."
        icon={isVoice ? (
          <Mic className="h-6 w-6 text-sagaone-login-card" />
        ) : (
          <MessageSquare className="h-6 w-6 text-sagaone-login-card" />
        )}
      />

      {/* Scenarios Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
            </Card>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhuma simulação disponível
          </h3>
          <p className="text-muted-foreground">
            Entre em contato com seu gestor para configurar simulações.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className="group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-sagaone-login-card/30"
              onClick={() => handleScenarioClick(scenario)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="text-xs font-normal">
                    {scenario.department}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-sagaone-login-card transition-colors" />
                </div>
                <CardTitle className="text-lg mt-3 group-hover:text-sagaone-login-card transition-colors">
                  {scenario.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {scenario.description || "Pratique suas habilidades neste cenário interativo."}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{scenario.personas.length} persona{scenario.personas.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex -space-x-2">
                    {scenario.personas.slice(0, 3).map((persona, idx) => (
                      <Avatar key={persona.id} className="h-8 w-8 border-2 border-card">
                        <AvatarFallback className="text-xs bg-sagaone-primary text-primary-foreground">
                          {persona.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {scenario.personas.length > 3 && (
                      <div className="h-8 w-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs text-muted-foreground">
                        +{scenario.personas.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Persona Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Escolha o Personagem</DialogTitle>
            <DialogDescription>
              {selectedScenario?.title} — Selecione com quem você deseja praticar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto pr-1">
            {selectedScenario?.personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => handlePersonaSelect(persona)}
                className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-sagaone-login-card/50 hover:bg-sagaone-login-card/5 transition-all duration-200 group"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 flex-shrink-0">
                    <AvatarFallback className="text-lg bg-sagaone-primary text-primary-foreground">
                      {persona.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground group-hover:text-sagaone-login-card transition-colors">
                        {persona.name}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getDifficultyColor(persona.difficulty))}
                      >
                        {getDifficultyIcon(persona.difficulty)} {persona.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {persona.role} • {persona.company}
                    </p>
                    {persona.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {persona.description}
                      </p>
                    )}
                    {persona.objective && (
                      <div className="flex items-start gap-2 mt-3 p-2 rounded-lg bg-muted/50">
                        <Target className="h-4 w-4 text-sagaone-login-card flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Objetivo:</span> {persona.objective}
                        </p>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-sagaone-login-card transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

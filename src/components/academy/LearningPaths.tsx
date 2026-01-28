import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  ArrowLeft,
  Download,
  ChevronRight,
  CheckCircle2,
  User,
  BookOpen,
} from "lucide-react";
import { LearningPath, LearningModule, Persona } from "@/types/academy";
import { cn } from "@/lib/utils";

// Mock learning paths
const mockPaths: LearningPath[] = [
  {
    id: "1",
    title: "Onboarding Vendedor",
    description: "Trilha essencial para novos vendedores da Saga",
    icon: "🎓",
    categories_count: 3,
    personas_count: 4,
    department: "Vendas Novos",
    completed: false,
    progress: 65,
    modules: [
      {
        id: "m1",
        title: "Outbound - fácil",
        description: "Primeira simulação de prospecção",
        difficulty: "Fácil",
        required_score: 7,
        completed: true,
        user_score: 8,
        personas: [
          {
            id: "p1",
            name: "Francisco",
            role: "Chief Financial Officer (CFO)",
            company: "Catarina Log",
            difficulty: "Fácil",
            description: "Cliente iniciante",
            objective: "Conhecer o produto",
          },
          {
            id: "p2",
            name: "Mateus",
            role: "Coordenador de Suporte",
            company: "Globalshoes",
            difficulty: "Médio",
            description: "Cliente exigente",
            objective: "Comparar preços",
          },
        ],
      },
      {
        id: "m2",
        title: "Atendimento Showroom",
        description: "Simulação de atendimento presencial",
        difficulty: "Médio",
        required_score: 7,
        completed: false,
        personas: [],
      },
    ],
  },
  {
    id: "2",
    title: "Técnicas Avançadas de Venda",
    description: "Aprimore suas habilidades de negociação",
    icon: "🚀",
    categories_count: 5,
    personas_count: 8,
    department: "Vendas Novos",
    completed: false,
    progress: 20,
    modules: [],
  },
  {
    id: "3",
    title: "Excelência no Pós-Venda",
    description: "Atendimento de qualidade na oficina",
    icon: "🔧",
    categories_count: 4,
    personas_count: 6,
    department: "Pós-Venda",
    completed: true,
    progress: 100,
    modules: [],
  },
];

export function LearningPaths() {
  const navigate = useNavigate();
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-green-100 text-green-700 border-green-200";
      case "Médio":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Difícil":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (selectedPath) {
    return (
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setSelectedPath(null)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Trilhas de Aprendizado
        </Button>

        {/* Path Header */}
        <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{selectedPath.icon}</div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedPath.title}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {selectedPath.categories_count} Categorias
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {selectedPath.personas_count} Personagens
                  </span>
                </div>
              </div>
            </div>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4" />
              Gerar Seu Certificado!
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Modules */}
        <div className="space-y-6">
          {selectedPath.modules.map((module) => (
            <Card key={module.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{module.title}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      module.completed
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {module.completed ? "Concluído" : "Disponível"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {module.personas.length} Personagens
                </div>
              </div>

              {/* Personas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {module.personas.map((persona) => (
                  <Card
                    key={persona.id}
                    className={cn(
                      "p-4 border-2 cursor-pointer transition-colors hover:border-primary/50",
                      getDifficultyColor(persona.difficulty)
                    )}
                    onClick={() => navigate("/treinamentos/simulacoes-voz")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {persona.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {module.completed && (
                          <CheckCircle2 className="absolute -top-1 -right-1 h-5 w-5 text-green-500 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {persona.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {persona.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {persona.role} @ {persona.company}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {persona.difficulty}
                          </Badge>
                          {module.required_score && (
                            <span className="text-xs text-muted-foreground">
                              Nota Necessária: {module.required_score}/10
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Trilhas de Aprendizado</h1>
      <p className="text-muted-foreground">
        Complete as trilhas para desenvolver suas habilidades e obter certificados.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPaths.map((path) => (
          <Card
            key={path.id}
            className="p-6 cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setSelectedPath(path)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">{path.icon}</div>
              <div>
                <h3 className="font-semibold text-foreground">{path.title}</h3>
                <p className="text-sm text-muted-foreground">{path.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {path.categories_count} Categorias
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {path.personas_count} Personagens
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso</span>
                <span>{path.progress}%</span>
              </div>
              <Progress value={path.progress} className="h-2" />
            </div>

            {path.completed && (
              <Badge className="mt-4 bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Concluído
              </Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  ArrowLeft,
  Download,
  ChevronRight,
  CheckCircle2,
  User,
  BookOpen,
  Mic,
  MessageSquare,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Training {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  departamento: string | null;
  dificuldade: string;
  duracao_minutos: number | null;
  nota_minima: number | null;
  ativo: boolean | null;
}

interface TrainingModule {
  id: string;
  treinamento_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  persona_nome: string | null;
  persona_cargo: string | null;
  persona_empresa: string | null;
  persona_objetivo: string | null;
}

interface UserProgress {
  id: string;
  treinamento_id: string;
  modulo_id: string | null;
  status: string;
  nota: number | null;
  tentativas: number;
  data_conclusao: string | null;
}

interface MandatoryTraining {
  id: string;
  treinamento_id: string;
  prazo: string | null;
  treinamentos?: Training;
}

export function LearningPaths() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  // Fetch trainings available to user
  const { data: trainings, isLoading: loadingTrainings } = useQuery({
    queryKey: ["user-trainings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamentos")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Training[];
    },
    enabled: !!user,
  });

  // Fetch modules for selected training
  const { data: modules, isLoading: loadingModules } = useQuery({
    queryKey: ["training-modules", selectedTraining?.id],
    queryFn: async () => {
      if (!selectedTraining) return [];
      
      const { data, error } = await supabase
        .from("treinamento_modulos")
        .select("*")
        .eq("treinamento_id", selectedTraining.id)
        .eq("ativo", true)
        .order("ordem");
      
      if (error) throw error;
      return data as TrainingModule[];
    },
    enabled: !!selectedTraining,
  });

  // Fetch user progress
  const { data: progress } = useQuery({
    queryKey: ["user-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamento_progresso")
        .select("*")
        .eq("user_id", user?.id);
      
      if (error) throw error;
      return data as UserProgress[];
    },
    enabled: !!user,
  });

  // Fetch mandatory trainings for user
  const { data: mandatoryTrainings } = useQuery({
    queryKey: ["mandatory-trainings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamento_obrigatorios")
        .select(`
          *,
          treinamentos (*)
        `)
        .eq("user_id", user?.id);
      
      if (error) throw error;
      return data as MandatoryTraining[];
    },
    enabled: !!user,
  });

  const getTrainingProgress = (trainingId: string) => {
    const trainingProgress = progress?.filter(p => p.treinamento_id === trainingId) || [];
    if (trainingProgress.length === 0) return 0;
    
    const completed = trainingProgress.filter(p => p.status === "concluido").length;
    const total = trainingProgress.length;
    return Math.round((completed / total) * 100);
  };

  const isTrainingCompleted = (trainingId: string) => {
    const trainingProgress = progress?.filter(p => p.treinamento_id === trainingId) || [];
    return trainingProgress.length > 0 && trainingProgress.every(p => p.status === "concluido");
  };

  const isModuleCompleted = (moduleId: string) => {
    return progress?.some(p => p.modulo_id === moduleId && p.status === "concluido");
  };

  const isMandatory = (trainingId: string) => {
    return mandatoryTrainings?.some(m => m.treinamento_id === trainingId);
  };

  const getMandatoryDeadline = (trainingId: string) => {
    const mandatory = mandatoryTrainings?.find(m => m.treinamento_id === trainingId);
    return mandatory?.prazo;
  };

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

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case "voz":
        return <Mic className="h-4 w-4" />;
      case "texto":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (tipo: string) => {
    switch (tipo) {
      case "voz":
        return <Badge className="bg-purple-100 text-purple-700"><Mic className="h-3 w-3 mr-1" />Voz</Badge>;
      case "texto":
        return <Badge className="bg-blue-100 text-blue-700"><MessageSquare className="h-3 w-3 mr-1" />Texto</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><BookOpen className="h-3 w-3 mr-1" />Curso</Badge>;
    }
  };

  // Loading state
  if (loadingTrainings) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg mb-4" />
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Selected training detail view
  if (selectedTraining) {
    const progressValue = getTrainingProgress(selectedTraining.id);
    const completed = isTrainingCompleted(selectedTraining.id);
    
    return (
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setSelectedTraining(null)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Trilhas de Aprendizado
        </Button>

        {/* Training Header */}
        <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                {getTypeIcon(selectedTraining.tipo)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">
                    {selectedTraining.titulo}
                  </h1>
                  {isMandatory(selectedTraining.id) && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Obrigatório
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{selectedTraining.descricao}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {getTypeBadge(selectedTraining.tipo)}
                  <Badge variant="outline">{selectedTraining.dificuldade}</Badge>
                  {selectedTraining.duracao_minutos && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {selectedTraining.duracao_minutos}min
                    </span>
                  )}
                  {modules && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {modules.length} Módulos
                    </span>
                  )}
                </div>
              </div>
            </div>
            {completed && (
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4" />
                Gerar Certificado
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Seu progresso</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        </Card>

        {/* Modules */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Módulos</h2>
          
          {loadingModules ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))}
            </div>
          ) : !modules?.length ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Este treinamento ainda não possui módulos configurados.
              </p>
              <Button 
                className="mt-4 gap-2"
                onClick={() => {
                  if (selectedTraining.tipo === "voz") {
                    navigate("/treinamentos/simulacoes-voz");
                  } else if (selectedTraining.tipo === "texto") {
                    navigate("/treinamentos/simulacoes-texto");
                  }
                }}
              >
                Iniciar Treinamento
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((module) => {
                const moduleCompleted = isModuleCompleted(module.id);
                
                return (
                  <Card
                    key={module.id}
                    className={cn(
                      "p-4 border-2 cursor-pointer transition-colors hover:border-primary/50",
                      moduleCompleted && "bg-green-50 border-green-200"
                    )}
                    onClick={() => {
                      if (selectedTraining.tipo === "voz") {
                        navigate("/treinamentos/simulacoes-voz");
                      } else if (selectedTraining.tipo === "texto") {
                        navigate("/treinamentos/simulacoes-texto");
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {module.persona_nome?.charAt(0) || (module.ordem + 1).toString()}
                          </AvatarFallback>
                        </Avatar>
                        {moduleCompleted && (
                          <CheckCircle2 className="absolute -top-1 -right-1 h-5 w-5 text-green-500 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {module.titulo}
                        </p>
                        {module.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {module.descricao}
                          </p>
                        )}
                        {module.persona_nome && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {module.persona_cargo} @ {module.persona_empresa}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Módulo {module.ordem + 1}
                          </Badge>
                          {selectedTraining.nota_minima && (
                            <span className="text-xs text-muted-foreground">
                              Nota Necessária: {selectedTraining.nota_minima}/10
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // No trainings available
  if (!trainings?.length) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Trilhas de Aprendizado</h1>
        <Card className="p-8 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Nenhum treinamento disponível</h2>
          <p className="text-muted-foreground">
            Não há treinamentos disponíveis para seu perfil no momento.
          </p>
        </Card>
      </div>
    );
  }

  // Separate mandatory and regular trainings
  const mandatoryIds = new Set(mandatoryTrainings?.map(m => m.treinamento_id) || []);
  const mandatoryList = trainings.filter(t => mandatoryIds.has(t.id));
  const regularList = trainings.filter(t => !mandatoryIds.has(t.id));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Trilhas de Aprendizado</h1>
      <p className="text-muted-foreground">
        Complete as trilhas para desenvolver suas habilidades e obter certificados.
      </p>

      {/* Mandatory Trainings Section */}
      {mandatoryList.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Treinamentos Obrigatórios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mandatoryList.map((training) => {
              const progressValue = getTrainingProgress(training.id);
              const completed = isTrainingCompleted(training.id);
              const deadline = getMandatoryDeadline(training.id);
              
              return (
                <Card
                  key={training.id}
                  className="p-6 cursor-pointer transition-shadow hover:shadow-md border-destructive/30 bg-destructive/5"
                  onClick={() => setSelectedTraining(training)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      {getTypeIcon(training.tipo)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{training.titulo}</h3>
                      {deadline && (
                        <p className="text-xs text-destructive">
                          Prazo: {new Date(deadline).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {training.descricao}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    {getTypeBadge(training.tipo)}
                    <Badge variant="outline">{training.dificuldade}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progresso</span>
                      <span>{progressValue}%</span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                  </div>

                  {completed && (
                    <Badge className="mt-4 bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular Trainings */}
      {regularList.length > 0 && (
        <div className="space-y-4">
          {mandatoryList.length > 0 && (
            <h2 className="text-lg font-semibold">Outros Treinamentos</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularList.map((training) => {
              const progressValue = getTrainingProgress(training.id);
              const completed = isTrainingCompleted(training.id);
              
              return (
                <Card
                  key={training.id}
                  className="p-6 cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setSelectedTraining(training)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {getTypeIcon(training.tipo)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{training.titulo}</h3>
                      {training.departamento && (
                        <p className="text-xs text-muted-foreground">{training.departamento}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {training.descricao}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    {getTypeBadge(training.tipo)}
                    <Badge variant="outline">{training.dificuldade}</Badge>
                    {training.duracao_minutos && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {training.duracao_minutos}min
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progresso</span>
                      <span>{progressValue}%</span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                  </div>

                  {completed && (
                    <Badge className="mt-4 bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

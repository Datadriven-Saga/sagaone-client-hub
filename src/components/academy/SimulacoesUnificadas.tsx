import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Target,
  ArrowLeft,
  ChevronRight,
  Mic,
  MessageSquare,
  AlertCircle,
  Play,
  Trophy,
  Search,
  Filter,
  X,
  Users,
  Flame,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcademySimulacoes, useAcademySessoes, useAcademyAtribuicoes } from "@/hooks/useAcademyData";
import { AcademyPageHeader } from "./AcademyPageHeader";
import { TrainingScenario, Persona } from "@/types/academy";

interface Simulacao {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  cenario: any;
  criterios_avaliacao: any;
  config_voz: any;
}

interface SimulacoesUnificadasProps {
  onStartSimulation: (scenario: TrainingScenario, persona: Persona) => void;
}

// Transform database simulacao to TrainingScenario format
function transformToScenario(simulacao: Simulacao): TrainingScenario {
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
    voice: configVoz.voice || p.voice || "echo", // Default to male voice
    gender: p.genero || p.gender || "masculino", // Default to male
  }));

  return {
    id: simulacao.id,
    title: simulacao.titulo,
    description: simulacao.descricao || "",
    department: cenario.departamento || "Vendas Novos",
    type: simulacao.tipo === "simulacao_voz" || simulacao.tipo === "voz" ? "voice" : "text",
    language: cenario.idioma || "Português",
    personas,
  };
}

export function SimulacoesUnificadas({ onStartSimulation }: SimulacoesUnificadasProps) {
  const [selectedSimulacao, setSelectedSimulacao] = useState<Simulacao | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Fetch all simulations
  const { data: simulacoes, isLoading: loadingSimulacoes } = useAcademySimulacoes();
  const { data: sessoes } = useAcademySessoes();
  const { data: atribuicoes } = useAcademyAtribuicoes();

  // Get stats for a simulation
  const getSimulacaoStats = (simulacaoId: string) => {
    const mySessoes = sessoes?.filter((s: any) => s.simulacao_id === simulacaoId) || [];
    const completed = mySessoes.filter((s: any) => s.status === "concluida");
    const bestScore = completed.length > 0 
      ? Math.max(...completed.map((s: any) => Number(s.nota_final || 0)))
      : null;
    return {
      attempts: mySessoes.length,
      completed: completed.length,
      bestScore,
    };
  };

  // Get persona from cenario
  const getPersonas = (simulacao: Simulacao) => {
    const cenario = simulacao.cenario || {};
    return cenario.personas || [];
  };

  // Get difficulty from first persona or cenario
  const getDifficulty = (simulacao: Simulacao) => {
    const personas = getPersonas(simulacao);
    if (personas.length > 0) {
      return personas[0].dificuldade || personas[0].difficulty || "Médio";
    }
    return simulacao.cenario?.dificuldade || "Médio";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
      case "iniciante":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Médio":
      case "intermediario":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Difícil":
      case "avancado":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getTypeIcon = (tipo: string) => {
    if (tipo === "simulacao_voz" || tipo === "simulacao" || tipo === "voz") {
      return <Mic className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  const isVoiceType = (tipo: string) => {
    return tipo === "simulacao_voz" || tipo === "simulacao" || tipo === "voz";
  };

  // Filter simulations - only filter if we have data
  const filteredSimulacoes = (simulacoes || []).filter((sim: Simulacao) => {
    const matchesSearch = sim.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sim.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const difficulty = getDifficulty(sim);
    const matchesDifficulty = difficultyFilter === "all" || 
      difficulty.toLowerCase().includes(difficultyFilter.toLowerCase());
    
    const matchesType = typeFilter === "all" || 
      (typeFilter === "voz" && isVoiceType(sim.tipo)) ||
      (typeFilter === "texto" && !isVoiceType(sim.tipo));
    
    return matchesSearch && matchesDifficulty && matchesType;
  });

  // Group by category/department
  const categorizedSimulacoes = filteredSimulacoes.reduce((acc: any, sim: Simulacao) => {
    const category = sim.cenario?.departamento || sim.cenario?.categoria || "Geral";
    if (!acc[category]) acc[category] = [];
    acc[category].push(sim);
    return acc;
  }, {});

  const hasFilters = searchTerm || difficultyFilter !== "all" || typeFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setDifficultyFilter("all");
    setTypeFilter("all");
  };

  const handleScenarioClick = (simulacao: Simulacao) => {
    const scenario = transformToScenario(simulacao);
    if (scenario.personas.length > 0) {
      setSelectedScenario(scenario);
      setIsModalOpen(true);
    } else {
      // Create default persona if none exists
      const defaultPersona: Persona = {
        id: "default",
        name: "Cliente Padrão",
        role: "Cliente",
        company: "Empresa",
        difficulty: getDifficulty(simulacao),
        description: simulacao.descricao || "",
        objective: "Praticar habilidades de atendimento",
        gender: "masculino",
        voice: "echo",
      };
      onStartSimulation(scenario, defaultPersona);
    }
  };

  const handlePersonaSelect = (persona: Persona) => {
    if (selectedScenario) {
      setIsModalOpen(false);
      onStartSimulation(selectedScenario, persona);
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

  // Loading state
  if (loadingSimulacoes) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg mb-4" />
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Selected simulation detail view
  if (selectedSimulacao) {
    const stats = getSimulacaoStats(selectedSimulacao.id);
    const personas = getPersonas(selectedSimulacao);
    const difficulty = getDifficulty(selectedSimulacao);
    const isVoice = isVoiceType(selectedSimulacao.tipo);
    
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setSelectedSimulacao(null)}
          className="gap-2 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Simulações
        </Button>

        {/* Simulation Header */}
        <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                {getTypeIcon(selectedSimulacao.tipo)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {selectedSimulacao.titulo}
                </h1>
                <p className="text-muted-foreground">{selectedSimulacao.descricao}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="outline" className={getDifficultyColor(difficulty)}>
                    {difficulty}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    {getTypeIcon(selectedSimulacao.tipo)}
                    {isVoice ? "Simulação por Voz" : "Simulação por Texto"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button 
              size="lg"
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => handleScenarioClick(selectedSimulacao)}
            >
              <Play className="h-5 w-5" />
              Iniciar Prática
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-2xl font-bold text-foreground">{stats.attempts}</p>
              <p className="text-sm text-muted-foreground">Tentativas</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {stats.bestScore !== null ? stats.bestScore.toFixed(1) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Melhor Nota</p>
            </div>
          </div>
        </Card>

        {/* Personas/Scenarios */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Personagens Disponíveis
          </h2>
          
          {personas.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Esta simulação tem um personagem padrão configurado.
              </p>
              <Button 
                className="mt-4 gap-2"
                onClick={() => handleScenarioClick(selectedSimulacao)}
              >
                Iniciar Prática
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona: any, index: number) => {
                const personaDifficulty = persona.dificuldade || persona.difficulty || "Médio";
                const scenario = transformToScenario(selectedSimulacao);
                const transformedPersona: Persona = {
                  id: persona.id || `persona-${index}`,
                  name: persona.nome || persona.name || `Persona ${index + 1}`,
                  role: persona.cargo || persona.role || "Cliente",
                  company: persona.empresa || persona.company || "Empresa",
                  difficulty: personaDifficulty,
                  description: persona.descricao || persona.description || "",
                  objective: persona.objetivo || persona.objective || "",
                  avatar: persona.avatar,
                  voice: persona.voice || selectedSimulacao.config_voz?.voice || "echo",
                  gender: persona.genero || persona.gender || "masculino",
                };
                
                return (
                  <Card
                    key={persona.id || index}
                    className="p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                    onClick={() => onStartSimulation(scenario, transformedPersona)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {(persona.nome || persona.name || "P").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          {persona.nome || persona.name || `Persona ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {persona.cargo || persona.role || "Cliente"} @ {persona.empresa || persona.company || "Empresa"}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={cn("mt-2 text-xs", getDifficultyColor(personaDifficulty))}
                        >
                          {personaDifficulty}
                        </Badge>
                      </div>
                    </div>
                    
                    {(persona.objetivo || persona.objective) && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Objetivo:</p>
                        <p className="text-sm text-foreground">
                          {persona.objetivo || persona.objective}
                        </p>
                      </div>
                    )}
                    
                    <Button className="w-full mt-4 gap-2" variant="outline">
                      <Play className="h-4 w-4" />
                      Praticar com {persona.nome || persona.name || "Persona"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Evaluation Criteria */}
        {Array.isArray(selectedSimulacao.criterios_avaliacao) && selectedSimulacao.criterios_avaliacao.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Critérios de Avaliação
            </h2>
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {selectedSimulacao.criterios_avaliacao.map((criterio: any, index: number) => (
                  <div key={index} className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium text-foreground">{criterio.dimensao}</p>
                    <p className="text-sm text-muted-foreground">Peso: {criterio.peso}%</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // No simulations available - only show if we have no data AND no filters applied
  if (filteredSimulacoes.length === 0 && !hasFilters && !loadingSimulacoes) {
    return (
      <div className="space-y-6">
        <AcademyPageHeader
          title="Simulações"
          description="Pratique suas habilidades através de roleplays interativos com IA."
          icon={<Flame className="h-6 w-6 text-orange-500" />}
        />
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhuma simulação disponível</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Simulações práticas estarão disponíveis em breve. 
            Pratique conversas reais com clientes virtuais para desenvolver suas habilidades.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AcademyPageHeader
        title="Simulações"
        description="Aprenda fazendo. Pratique situações reais através de roleplays interativos com IA — por voz ou texto."
        icon={<Flame className="h-6 w-6 text-orange-500" />}
      />

      {/* Type Tabs */}
      <Tabs defaultValue="todos" className="w-full" onValueChange={(value) => {
        if (value === "todos") setTypeFilter("all");
        else if (value === "voz") setTypeFilter("voz");
        else if (value === "texto") setTypeFilter("texto");
      }}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="todos" className="gap-2">
            Todos
          </TabsTrigger>
          <TabsTrigger value="voz" className="gap-2">
            <Mic className="h-4 w-4" />
            Voz
          </TabsTrigger>
          <TabsTrigger value="texto" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Texto
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar simulações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Dificuldade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fácil">Fácil</SelectItem>
              <SelectItem value="médio">Médio</SelectItem>
              <SelectItem value="difícil">Difícil</SelectItem>
            </SelectContent>
          </Select>
          
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </Card>

      {/* Assigned/Priority Simulations */}
      {atribuicoes && atribuicoes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Simulações Prioritárias
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {atribuicoes
              .filter((a: any) => a.status === "pendente")
              .slice(0, 3)
              .map((atrib: any) => {
                const treinamento = atrib.treinamento;
                return (
                  <Card
                    key={atrib.id}
                    className="p-4 cursor-pointer border-destructive/30 bg-destructive/5 hover:shadow-md transition-shadow"
                    onClick={() => {
                      const sim = simulacoes?.find((s: Simulacao) => s.id === treinamento?.id);
                      if (sim) handleScenarioClick(sim);
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <Mic className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{treinamento?.titulo}</p>
                        {atrib.data_limite && (
                          <p className="text-xs text-destructive">
                            Prazo: {new Date(atrib.data_limite).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button className="w-full gap-2" size="sm">
                      <Play className="h-4 w-4" />
                      Iniciar Prática
                    </Button>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Simulations by Category */}
      {Object.entries(categorizedSimulacoes).map(([category, sims]: [string, any]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sims.map((simulacao: Simulacao) => {
              const stats = getSimulacaoStats(simulacao.id);
              const difficulty = getDifficulty(simulacao);
              const personas = getPersonas(simulacao);
              const isVoice = isVoiceType(simulacao.tipo);
              
              return (
                <Card
                  key={simulacao.id}
                  className="p-5 cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
                  onClick={() => setSelectedSimulacao(simulacao)}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      isVoice ? "bg-purple-100 group-hover:bg-purple-200 dark:bg-purple-900/30" : "bg-blue-100 group-hover:bg-blue-200 dark:bg-blue-900/30"
                    )}>
                      {getTypeIcon(simulacao.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{simulacao.titulo}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {simulacao.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className={getDifficultyColor(difficulty)}>
                      {difficulty}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {personas.length || 1} persona{personas.length !== 1 ? "s" : ""}
                    </Badge>
                    {stats.bestScore !== null && (
                      <Badge className="bg-green-100 text-green-700 gap-1">
                        <Trophy className="h-3 w-3" />
                        {stats.bestScore.toFixed(0)}
                      </Badge>
                    )}
                  </div>

                  {stats.attempts > 0 && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{stats.completed}/{stats.attempts}</span>
                      </div>
                      <Progress 
                        value={stats.attempts > 0 ? (stats.completed / stats.attempts) * 100 : 0} 
                        className="h-2" 
                      />
                    </div>
                  )}

                  <Button className="w-full gap-2" variant={stats.attempts > 0 ? "outline" : "default"}>
                    <Play className="h-4 w-4" />
                    {stats.attempts > 0 ? "Praticar Novamente" : "Iniciar Prática"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Empty state for filters */}
      {hasFilters && filteredSimulacoes.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Nenhuma simulação encontrada</h2>
          <p className="text-muted-foreground mb-4">
            Tente ajustar os filtros para encontrar mais simulações.
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Limpar Filtros
          </Button>
        </Card>
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

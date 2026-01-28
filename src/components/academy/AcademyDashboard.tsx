import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Sparkles, Loader2, X, Check, User, LayoutTemplate } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

// Mock data for radar chart
const radarData = [
  { dimension: "Situação", score: 2.5, fullMark: 10 },
  { dimension: "Problema", score: 4.2, fullMark: 10 },
  { dimension: "Implicação", score: 0.8, fullMark: 10 },
  { dimension: "Negociação e Objeção", score: 0.6, fullMark: 10 },
  { dimension: "Fechamento e Próximos Passos", score: 0.0, fullMark: 10 },
];

const dimensionScores = [
  { name: "Situação", score: 2.5, color: "bg-red-100 text-red-700" },
  { name: "Problema", score: 4.2, color: "bg-red-100 text-red-700" },
  { name: "Implicação", score: 0.8, color: "bg-red-100 text-red-700" },
  { name: "Negociação e Objeção", score: 0.6, color: "bg-red-100 text-red-700" },
  { name: "Fechamento e Próximos Passos", score: 0.0, color: "bg-red-100 text-red-700" },
];

const situationItems = [
  { question: "Se apresentou e transmitiu credibilidade?", score: 5.0, maxScore: 10 },
  { question: "Cumprimentou o cliente com entusiasmo e respeito?", score: 2.5, maxScore: 10 },
  { question: "Demonstrou interesse genuíno pelo cliente?", score: 2.5, maxScore: 10 },
  { question: "Criou ambiente positivo e confortável?", score: 0.0, maxScore: 10 },
];

interface Filters {
  dataInicio: string;
  dataTermino: string;
  duracao: number;
  time: string;
  colaborador: string;
  template: string;
}

export function AcademyDashboard() {
  const [activeTab, setActiveTab] = useState("performance");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<Filters>({
    dataInicio: "",
    dataTermino: "",
    duracao: 0,
    time: "",
    colaborador: "",
    template: "",
  });

  const handleGenerateRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock recommendations based on dimension scores
    const mockRecommendations = [
      "🎯 Foco prioritário: Trabalhe técnicas de fechamento - sua nota atual é 0.0. Pratique simulações de fechamento com objeções.",
      "💡 Melhore a apresentação pessoal: Dedique 5 minutos antes de cada reunião para preparar uma introdução impactante.",
      "🔄 Pratique a escuta ativa: Nas próximas simulações, foque em identificar os problemas do cliente antes de propor soluções.",
      "📈 Acompanhe seu progresso: Realize ao menos 2 simulações por semana para acelerar seu desenvolvimento.",
    ];
    
    setRecommendations(mockRecommendations);
    setIsGeneratingRecommendations(false);
  };

  const handleClearFilters = () => {
    setFilters({
      dataInicio: "",
      dataTermino: "",
      duracao: 0,
      time: "",
      colaborador: "",
      template: "",
    });
  };

  const handleApplyFilters = () => {
    // Apply filters logic here
    console.log("Applying filters:", filters);
    setIsFiltersOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[450px]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-6 py-6">
              {/* Período */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Período</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio" className="text-sm text-muted-foreground">Data de Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={filters.dataInicio}
                      onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataTermino" className="text-sm text-muted-foreground">Data de Término</Label>
                    <Input
                      id="dataTermino"
                      type="date"
                      value={filters.dataTermino}
                      onChange={(e) => setFilters({ ...filters, dataTermino: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Duração */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Duração (minutos)</Label>
                <div className="px-2">
                  <div className="text-sm text-primary font-medium mb-2">{filters.duracao}</div>
                  <Slider
                    value={[filters.duracao]}
                    onValueChange={([value]) => setFilters({ ...filters, duracao: value })}
                    max={120}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Time */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Time</Label>
                <Select 
                  value={filters.time} 
                  onValueChange={(value) => setFilters({ ...filters, time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Times" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="pos-vendas">Pós-Vendas</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Colaborador */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Colaborador</Label>
                <Select 
                  value={filters.colaborador} 
                  onValueChange={(value) => setFilters({ ...filters, colaborador: value })}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Usuários" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativos">Usuários Ativos</SelectItem>
                    <SelectItem value="novos">Novos Usuários</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template de Reunião */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Template de Reunião</Label>
                <Select 
                  value={filters.template} 
                  onValueChange={(value) => setFilters({ ...filters, template: value })}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Atendimento Automóvel" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atendimento-automovel">Atendimento Automóvel</SelectItem>
                    <SelectItem value="pos-venda">Pós-Venda</SelectItem>
                    <SelectItem value="financiamento">Financiamento</SelectItem>
                    <SelectItem value="test-drive">Test Drive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SheetFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleClearFilters} className="flex-1 gap-2">
                <X className="h-4 w-4" />
                Limpar
              </Button>
              <Button onClick={handleApplyFilters} className="flex-1 gap-2 bg-primary hover:bg-primary/90">
                <Check className="h-4 w-4" />
                Aplicar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="metricas">Métricas de Uso</TabsTrigger>
          <TabsTrigger value="analises">Tabela de Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Dimensões de avaliação</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="dimension" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 10]} 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Recommendations */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Recomendações</h3>
                  <Badge variant="outline" className="text-xs">experimental</Badge>
                </div>
              </div>
              
              <Button 
                onClick={handleGenerateRecommendations}
                disabled={isGeneratingRecommendations}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {isGeneratingRecommendations ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar Recomendações
                  </>
                )}
              </Button>
              
              {recommendations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                      {rec}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">
                  Clique para gerar recomendações personalizadas baseadas no seu desempenho nas simulações.
                </p>
              )}
            </Card>
          </div>

          {/* Dimension Scores */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            {dimensionScores.map((dim) => (
              <Card key={dim.name} className={`p-4 ${dim.color}`}>
                <p className="text-2xl font-bold">{dim.score.toFixed(1)}</p>
                <p className="text-sm">{dim.name}</p>
              </Card>
            ))}
          </div>

          {/* Situation Breakdown */}
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">SITUAÇÃO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {situationItems.map((item, index) => (
                <Card key={index} className="p-4 bg-card border">
                  <p className="text-sm text-foreground mb-2">{item.question}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.score.toFixed(1)}/{item.maxScore}
                  </p>
                  <Progress 
                    value={(item.score / item.maxScore) * 100} 
                    className="h-2"
                  />
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metricas" className="mt-6">
          <Card className="p-6">
            <p className="text-muted-foreground">Métricas de uso em breve...</p>
          </Card>
        </TabsContent>

        <TabsContent value="analises" className="mt-6">
          <Card className="p-6">
            <p className="text-muted-foreground">Tabela de análises em breve...</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

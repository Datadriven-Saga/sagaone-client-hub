import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Sparkles, Loader2, X, Check, User, LayoutTemplate, TrendingUp, BookOpen, Mic, Clock, ChevronRight } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useAcademyRadarData, useAcademyRecomendacoes, useGenerateRecomendacoes, useAcademySessoes, useAcademyProgresso } from "@/hooks/useAcademyData";

function wrapTickLabel(value: string, maxLineLength = 14) {
  const words = value.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxLineLength) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);

  return lines.slice(0, 3);
}

function RadarAxisTick(props: any) {
  const { x, y, payload } = props;
  const value = String(payload?.value ?? "");
  const lines = wrapTickLabel(value);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="hsl(var(--muted-foreground))"
      fontSize={10}
    >
      {lines.map((line, idx) => (
        <tspan key={idx} x={x} dy={idx === 0 ? "0.35em" : "1.1em"}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

interface Filters {
  dataInicio: string;
  dataTermino: string;
  duracao: number;
  time: string;
  colaborador: string;
  template: string;
}

export function AcademyDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("performance");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    dataInicio: "",
    dataTermino: "",
    duracao: 0,
    time: "",
    colaborador: "",
    template: "",
  });

  // Data hooks
  const { radarData, dimensionScores, metrics } = useAcademyRadarData();
  const { data: recomendacoes, isLoading: loadingRecomendacoes } = useAcademyRecomendacoes();
  const { data: sessoes, isLoading: loadingSessoes } = useAcademySessoes(5);
  const { data: progresso, isLoading: loadingProgresso } = useAcademyProgresso();
  const generateRecomendacoes = useGenerateRecomendacoes();

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
    console.log("Applying filters:", filters);
    setIsFiltersOpen(false);
  };

  // Calculate stats
  const totalSimulacoes = metrics?.total_simulacoes_realizadas || 0;
  const treinamentosConcluidos = metrics?.treinamentos_concluidos || 0;
  const emAndamento = metrics?.treinamentos_em_andamento || 0;
  const tempoTotal = metrics?.tempo_total_minutos || 0;
  const mediaGeral = Number(metrics?.media_geral || 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard de Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe seu progresso nas simulações práticas
          </p>
        </div>
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:w-[400px] max-w-full">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/treinamentos/simulacoes-voz")}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Mic className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Simulação por Voz</h3>
              <p className="text-sm text-muted-foreground">Pratique conversas reais com clientes virtuais</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/treinamentos/simulacoes")}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Todas as Simulações</h3>
              <p className="text-sm text-muted-foreground">Explore cenários de roleplay disponíveis</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">{mediaGeral.toFixed(1)}</p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Média Geral</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Mic className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">{totalSimulacoes}</p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Simulações</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">{treinamentosConcluidos}</p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Concluídos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground">{tempoTotal}</p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Min. de treino</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto">
          <TabsTrigger value="performance" className="text-xs md:text-sm">Performance</TabsTrigger>
          <TabsTrigger value="metricas" className="text-xs md:text-sm">Métricas de Uso</TabsTrigger>
          <TabsTrigger value="analises" className="text-xs md:text-sm">Tabela de Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Radar Chart */}
            <Card className="p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4">Dimensões de avaliação</h3>
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    margin={{ top: 24, right: 56, bottom: 24, left: 56 }}
                  >
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="dimension" 
                      tick={<RadarAxisTick />}
                      tickLine={false}
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
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Recommendations */}
            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Recomendações</h3>
                  <Badge variant="outline" className="text-xs">experimental</Badge>
                </div>
              </div>
              
              <Button 
                onClick={() => generateRecomendacoes.mutate()}
                disabled={generateRecomendacoes.isPending}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {generateRecomendacoes.isPending ? (
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
              
              {loadingRecomendacoes ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : recomendacoes && recomendacoes.length > 0 ? (
                <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                  {recomendacoes.map((rec) => (
                    <div key={rec.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium text-foreground">{rec.titulo}</p>
                      <p className="text-muted-foreground mt-1">{rec.descricao}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mt-6">
            {dimensionScores.map((dim) => (
              <Card key={dim.name} className={`p-3 md:p-4 ${dim.color}`}>
                <p className="text-xl md:text-2xl font-bold">{dim.score.toFixed(1)}</p>
                <p className="text-xs md:text-sm truncate">{dim.name}</p>
              </Card>
            ))}
          </div>

          {/* Recent Sessions */}
          <Card className="p-4 md:p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Sessões Recentes</h3>
            {loadingSessoes ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sessoes && sessoes.length > 0 ? (
              <div className="space-y-3">
                {sessoes.map((sessao: any) => (
                  <div key={sessao.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {sessao.simulacao?.titulo || "Simulação"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sessao.data_inicio).toLocaleDateString("pt-BR")}
                        {sessao.duracao_segundos && ` • ${Math.floor(sessao.duracao_segundos / 60)}min`}
                      </p>
                    </div>
                    {sessao.nota_final !== null && (
                      <Badge className={sessao.nota_final >= 7 ? "bg-green-100 text-green-700" : sessao.nota_final >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                        {Number(sessao.nota_final).toFixed(1)}/10
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você ainda não realizou nenhuma simulação. Comece agora para acompanhar seu progresso!
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="metricas" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4">Tempo de Estudo</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Tempo total</span>
                    <span className="font-medium">{tempoTotal} minutos</span>
                  </div>
                  <Progress value={Math.min((tempoTotal / 120) * 100, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">Meta: 120 minutos/semana</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4">Progresso em Treinamentos</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Concluídos</span>
                  <Badge className="bg-green-100 text-green-700">{treinamentosConcluidos}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Em andamento</span>
                  <Badge className="bg-yellow-100 text-yellow-700">{emAndamento}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total disponível</span>
                  <Badge variant="outline">{metrics?.total_treinamentos_disponiveis || 0}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analises" className="mt-6">
          <Card className="p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-4">Progresso Detalhado</h3>
            {loadingProgresso ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : progresso && progresso.length > 0 ? (
              <div className="space-y-4">
                {progresso.map((item: any) => (
                  <div key={item.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground">
                        {item.treinamento?.titulo || "Treinamento"}
                      </p>
                      <Badge variant="outline">{item.treinamento?.nivel || "—"}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Progresso: {item.percentual_concluido}%</span>
                      {item.nota !== null && <span>Nota: {item.nota}/10</span>}
                      <span>Tentativas: {item.tentativas}</span>
                    </div>
                    <Progress value={item.percentual_concluido} className="h-2 mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum progresso registrado ainda. Inicie um treinamento para acompanhar seu desenvolvimento.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Filter, Sparkles } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { PerformanceDimension } from "@/types/academy";

// Mock data for radar chart
const radarData = [
  { dimension: "Situação", score: 2.5, fullMark: 10 },
  { dimension: "Problema", score: 4.2, fullMark: 10 },
  { dimension: "Implicação", score: 0.8, fullMark: 10 },
  { dimension: "Negociação", score: 0.6, fullMark: 10 },
  { dimension: "Fechamento", score: 0.0, fullMark: 10 },
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

export function AcademyDashboard() {
  const [activeTab, setActiveTab] = useState("performance");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
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
              <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                <Sparkles className="h-4 w-4" />
                Gerar Recomendações
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Clique para gerar recomendações personalizadas baseadas no seu desempenho nas simulações.
              </p>
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

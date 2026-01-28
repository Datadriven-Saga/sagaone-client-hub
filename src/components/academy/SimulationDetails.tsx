import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  FileDown,
  Clock,
  Calendar,
  Mic,
  Play,
  Pause,
  Volume2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart3,
  MessageSquare,
  Sparkles,
  Star,
} from "lucide-react";

// Mock data
const mockFeedback = {
  scenario_title: "Atendimento Automóvel com Lucas",
  type: "voice" as const,
  duration: "00:02:09",
  date: "01-12-2025",
  overall_score: 4,
  summary: "Rafael se apresentou bem e demonstrou interesse genuíno, mas falhou em criar um ambiente confortável e em apresentar soluções claras para as objeções de Lucas. Como ação prática, ofereça alternativas de financiamento: 'Podemos alongar o prazo para ajustar as parcelas ao seu orçamento'.",
  highlights: [
    "Rafael demonstrou interesse genuíno ao perguntar sobre a troca de carro e a família de Lucas: 'Tu está querendo trocar de carro? Tu já tem 1 carro hoje?'",
  ],
  recommendations: [
    "Apresente detalhes técnicos e diferenciais da empresa: 'O Compass tem um excelente espaço interno e nossa garantia cobre revisões por dois anos'.",
  ],
  categories: [
    {
      name: "Situação",
      score: 4,
      feedback: "Rafael se apresentou e cumprimentou Lucas de forma respeitosa: 'Oi Lucas, tudo bem? Eu sou o Rafael'. Ele demonstrou interesse ao perguntar sobre a troca de carro e a família de Lucas. No entanto, não ofereceu água ou café, nem conduziu a conversa em um tom acolhedor para criar um ambiente mais confortável.",
      items: [
        { question: "Se apresentou e transmitiu credibilidade?", passed: true },
        { question: "Cumprimentou o cliente com entusiasmo e respeito?", passed: true },
        { question: "Demonstrou interesse genuíno pelo cliente?", passed: true },
        { question: "Criou ambiente positivo e confortável?", passed: false },
      ],
    },
    {
      name: "Problema",
      score: 3,
      feedback: "...",
      items: [],
    },
  ],
  speech_metrics: {
    talkListenRatio: 53,
    recommendedRatio: { min: 40, max: 50 },
    fillerWords: 8,
    recommendedFillerWords: { min: 0, max: 3 },
    wordsPerMinute: 207,
    recommendedWPM: { min: 110, max: 160 },
  },
  transcription: [
    { role: "ai", content: "Olá. Sou o Lucas. Eu falei pelo telefone com alguém e agendei 1 visita." },
    { role: "user", content: "Oi Lucas, tudo bem? Eu sou o Rafael posso te atender aqui hoje então é o que tu procura?" },
    { role: "ai", content: "Tudo bem sim, vim ver o Compass Longitude, aquele 1.3 turbo que vi no site de vocês," },
    { role: "user", content: "Ah perfeito, claro consigo te mostrar aqui o carro para tu como é que ele é, tirar suas dúvidas. Tu está querendo trocar de carro? Tu já tem 1 carro hoje?" },
  ],
};

export function SimulationDetails() {
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const getScoreColor = (score: number) => {
    if (score >= 7) return "bg-green-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">L</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {mockFeedback.scenario_title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Mic className="h-3 w-3" />
                Voz
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {mockFeedback.duration}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {mockFeedback.date}
              </span>
            </div>
          </div>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="visao_geral" className="gap-2">
                <Eye className="h-4 w-4" />
                Visão geral
              </TabsTrigger>
              <TabsTrigger value="pontuacao" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Quadro de pontuação
              </TabsTrigger>
              <TabsTrigger value="habilidades" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Habilidades de fala
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao_geral" className="mt-6 space-y-6">
              {/* Overall Score */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Nota Geral</h3>
                  <Badge className={`${getScoreColor(mockFeedback.overall_score)} text-white`}>
                    {mockFeedback.overall_score}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{mockFeedback.summary}</p>
              </Card>

              {/* Highlights */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold">Destaques</h3>
                </div>
                {mockFeedback.highlights.map((highlight, index) => (
                  <p key={index} className="text-muted-foreground">{highlight}</p>
                ))}
              </Card>

              {/* Recommendations */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Recomendações</h3>
                </div>
                {mockFeedback.recommendations.map((rec, index) => (
                  <p key={index} className="text-muted-foreground">{rec}</p>
                ))}
              </Card>
            </TabsContent>

            <TabsContent value="pontuacao" className="mt-6 space-y-6">
              {mockFeedback.categories.map((category) => (
                <Card key={category.name} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{category.name}</h3>
                    <Badge variant="outline">Feedback ✨</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">{category.feedback}</p>
                  
                  {category.items.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {category.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <span className="text-foreground">{item.question}</span>
                          {item.passed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="habilidades" className="mt-6 space-y-6">
              <Card className="p-6 space-y-6">
                {/* Talk/Listen Ratio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Relação fala/escuta</span>
                    <Badge variant="outline">
                      Recomendação: {mockFeedback.speech_metrics.recommendedRatio.min} até {mockFeedback.speech_metrics.recommendedRatio.max}
                    </Badge>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${mockFeedback.speech_metrics.talkListenRatio}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mockFeedback.speech_metrics.talkListenRatio}%
                  </p>
                </div>

                {/* Filler Words */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Vícios de linguagem (é..., então, tipo, etc.)</span>
                    <Badge variant="outline">
                      Recomendação: {mockFeedback.speech_metrics.recommendedFillerWords.min} até {mockFeedback.speech_metrics.recommendedFillerWords.max}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold">
                    {mockFeedback.speech_metrics.fillerWords} palavras por minuto
                  </p>
                </div>

                {/* Words Per Minute */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Velocidade de fala</span>
                    <Badge variant="outline">
                      Recomendação: {mockFeedback.speech_metrics.recommendedWPM.min} até {mockFeedback.speech_metrics.recommendedWPM.max}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold">
                    {mockFeedback.speech_metrics.wordsPerMinute} palavras por minuto
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Recording & Transcription */}
        <div className="space-y-6">
          {/* Recording Player */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Gravação</h3>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <div className="flex-1 space-y-1">
                <Slider
                  value={[audioProgress]}
                  onValueChange={([val]) => setAudioProgress(val)}
                  max={100}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0:00</span>
                  <span>/ 2:11</span>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <Volume2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Transcription */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Transcrição</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {mockFeedback.transcription.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "ai" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        L
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        V
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

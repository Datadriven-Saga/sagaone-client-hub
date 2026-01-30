import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileDown,
  Clock,
  Calendar,
  Mic,
  MessageSquare,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart3,
  Sparkles,
  Star,
} from "lucide-react";
import { AcademyPageHeader } from "./AcademyPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TranscriptionItem {
  role: 'user' | 'ai';
  content: string;
  timestamp?: string;
}

interface CategoryItem {
  question: string;
  passed: boolean;
}

interface Category {
  name: string;
  score: number;
  feedback: string;
  items: CategoryItem[];
}

export function SimulationDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch session data from database
  const { data: sessao, isLoading, error } = useQuery({
    queryKey: ["academy-sessao-details", id],
    queryFn: async () => {
      if (!id) return null;

      // IMPORTANT: avoid embedding profile here because it can fail depending on
      // PostgREST relationship cache / RLS on profiles, which was causing the UI
      // to fall back to "Sessão não encontrada" even when the session exists.
      const { data, error } = await supabase
        .from("academy_sessoes_simulacao")
        .select(`
          *,
          simulacao:simulacao_id (
            titulo,
            tipo,
            descricao,
            cenario,
            criterios_avaliacao
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      // Best-effort profile fetch (do not block details view if it fails)
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nome_completo")
          .eq("id", data.user_id)
          .maybeSingle();

        return {
          ...data,
          profile: profileData || null,
        } as any;
      } catch {
        return data as any;
      }
    },
    enabled: !!id,
  });

  // Parse session data
  const simulacao = sessao?.simulacao as any;
  const cenario = simulacao?.cenario || {};
  const personas = cenario?.personas || [];
  const personaName = personas[0]?.nome || personas[0]?.name || "Cliente";
  const userName = (sessao?.profile as any)?.nome_completo || "Usuário";
  
  // Parse transcription
  const transcription: TranscriptionItem[] = Array.isArray(sessao?.transcricao) 
    ? (sessao.transcricao as unknown as TranscriptionItem[])
    : [];

  // Parse evaluations
  const avaliacoes = sessao?.avaliacoes as any || {};
  const userRating = avaliacoes?.user_rating || 0;
  const userComment = avaliacoes?.user_comment || "";
  const notaFinal = Number(sessao?.nota_final || 0);

  // Parse criteria-based feedback (if available in avaliacoes)
  const categories: Category[] = simulacao?.criterios_avaliacao?.map((criterio: any) => ({
    name: criterio.dimensao,
    score: 0,
    feedback: "",
    items: criterio.itens?.map((item: any) => ({
      question: item.pergunta,
      passed: false,
    })) || [],
  })) || [];

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd-MM-yyyy", { locale: ptBR });
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return "bg-green-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-red-500";
  };

  const isVoice = simulacao?.tipo === "voz" || simulacao?.tipo === "simulacao_voz";

  // Audio playback handlers
  const togglePlayback = () => {
    // For now, show message that audio recording is coming soon
    // In the future, this would play the recorded session audio
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    // Simulate audio progress for demo
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const totalDuration = sessao?.duracao_segundos || 120;
      setAudioDuration(totalDuration);
      interval = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + (100 / totalDuration);
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, sessao?.duracao_segundos]);

  const exportToPDF = () => {
    // TODO: Implement PDF export
    alert("Exportação para PDF em desenvolvimento");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full" />
          </div>
          <div>
            <Skeleton className="h-[200px] w-full mb-4" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AcademyPageHeader
          title="Erro ao carregar sessão"
          backPath="/treinamentos/historico"
          icon={<Eye className="h-6 w-6 text-muted-foreground" />}
        />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Não foi possível carregar os detalhes desta sessão. Tente novamente.
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate("/treinamentos/historico")}
          >
            Voltar ao Histórico
          </Button>
        </Card>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div className="space-y-6">
        <AcademyPageHeader
          title="Sessão não encontrada"
          backPath="/treinamentos/historico"
          icon={<Eye className="h-6 w-6 text-muted-foreground" />}
        />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            A sessão solicitada não foi encontrada.
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate("/treinamentos/historico")}
          >
            Voltar ao Histórico
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <AcademyPageHeader
        title={simulacao?.titulo || "Detalhes da Simulação"}
        backPath="/treinamentos/historico"
        icon={<Eye className="h-6 w-6 text-sagaone-login-card" />}
        actions={
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={exportToPDF}>
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        }
      />

      {/* Meta info */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
        <Badge variant="outline" className="gap-1">
          {isVoice ? <Mic className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {isVoice ? "Voz" : "Texto"}
        </Badge>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {formatDuration(sessao.duracao_segundos)}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {formatDate(sessao.data_inicio)}
        </span>
        <span className="text-muted-foreground">
          Usuário: <strong>{userName}</strong>
        </span>
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
                Avaliação do Usuário
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao_geral" className="mt-6 space-y-6">
              {/* Overall Score */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Nota Geral</h3>
                  <Badge className={`${getScoreColor(notaFinal)} text-white`}>
                    {notaFinal.toFixed(1)}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {sessao.feedback_ia || "Feedback da IA não disponível para esta sessão."}
                </p>
              </Card>

              {/* Stats Summary */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Resumo da Sessão</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {formatDuration(sessao.duracao_segundos)}
                    </p>
                    <p className="text-sm text-muted-foreground">Duração</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {transcription.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Mensagens</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {transcription.filter(t => t.role === 'user').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Falas do Vendedor</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {transcription.filter(t => t.role === 'ai').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Falas do Cliente</p>
                  </div>
                </div>
              </Card>

              {/* Highlights */}
              {Array.isArray(sessao.pontos_fortes) && (sessao.pontos_fortes as string[]).length > 0 && (
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold">Pontos Fortes</h3>
                  </div>
                  <ul className="space-y-2">
                    {(sessao.pontos_fortes as string[]).map((ponto, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {ponto}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Recommendations */}
              {Array.isArray(sessao.pontos_melhoria) && (sessao.pontos_melhoria as string[]).length > 0 && (
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Pontos de Melhoria</h3>
                  </div>
                  <ul className="space-y-2">
                    {(sessao.pontos_melhoria as string[]).map((ponto, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <XCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        {ponto}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pontuacao" className="mt-6 space-y-6">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <Card key={category.name} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                      <Badge variant="outline">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Feedback
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {category.feedback || "Avaliação detalhada disponível após análise da IA."}
                    </p>
                    
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
                              <XCircle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Critérios de avaliação detalhados não disponíveis para esta sessão.
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="habilidades" className="mt-6 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Avaliação do Usuário</h3>
                
                {/* Star Rating Display */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Nota:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= userRating 
                            ? "text-yellow-500 fill-yellow-500" 
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-semibold ml-2">{userRating}/5</span>
                </div>

                {userComment && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Comentário do usuário:
                    </p>
                    <p className="text-foreground">{userComment}</p>
                  </div>
                )}

                {!userRating && (
                  <p className="text-muted-foreground">
                    Nenhuma avaliação do usuário disponível para esta sessão.
                  </p>
                )}
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
                onClick={togglePlayback}
                disabled={!isVoice}
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
                  disabled={!isVoice}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatDuration(Math.floor((audioProgress / 100) * (sessao.duracao_segundos || 0)))}</span>
                  <span>/ {formatDuration(sessao.duracao_segundos)}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" disabled>
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>
            {!isVoice && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Gravação de áudio disponível apenas para simulações por voz.
              </p>
            )}
            {isVoice && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Gravação de áudio em desenvolvimento.
              </p>
            )}
          </Card>

          {/* Transcription */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Transcrição</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {transcription.length > 0 ? (
                transcription.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "ai" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {personaName.charAt(0)}
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
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma transcrição disponível.</p>
                  <p className="text-xs mt-1">
                    A transcrição será salva automaticamente ao encerrar a simulação.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

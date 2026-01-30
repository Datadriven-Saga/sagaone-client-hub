import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  BookOpen,
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Building2,
  X,
  UserPlus,
  Eye,
  Calendar,
  AlertCircle,
  GraduationCap,
  Layers,
  FileText,
  PlayCircle,
  Volume2,
  Square,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useCompany } from "@/contexts/CompanyContext";
import { 
  useAcademyTreinamentosAdmin, 
  useCreateTreinamento, 
  useAssignTreinamento,
  useCreateSimulacao,
  useAcademySimulacoes,
} from "@/hooks/useAcademyData";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AcademyPageHeader } from "./AcademyPageHeader";

const ITEMS_PER_PAGE = 10;

const DEPARTMENTS = [
  "Vendas Novos",
  "Vendas Seminovos", 
  "Pós-Venda",
  "Oficina",
  "F&I",
  "Peças",
  "Funilaria",
  "CRM",
  "Recepção",
];

const NIVEIS = [
  { value: "iniciante", label: "Fácil" },
  { value: "intermediario", label: "Médio" },
  { value: "avancado", label: "Difícil" },
];

// Saga Academy = Simulações práticas (não cursos teóricos)
const TIPOS = [
  { value: "simulacao", label: "Simulação por Voz", icon: "🎙️" },
  { value: "texto", label: "Simulação por Texto", icon: "💬" },
];

// Cenários de roleplay
const CENARIOS = [
  "Venda de Veículo Novo",
  "Venda de Seminovo", 
  "Atendimento Pós-Venda",
  "Negociação de Financiamento",
  "Tratamento de Objeções",
  "Agendamento de Test Drive",
  "Follow-up de Lead",
  "Recuperação de Cliente",
];

// OpenAI Realtime voices
const VOZES_IA = [
  { value: "shimmer", label: "Shimmer (Feminina)", gender: "F" },
  { value: "alloy", label: "Alloy (Neutra)", gender: "N" },
  { value: "echo", label: "Echo (Masculina)", gender: "M" },
  { value: "fable", label: "Fable (Masculina)", gender: "M" },
  { value: "onyx", label: "Onyx (Masculina)", gender: "M" },
  { value: "nova", label: "Nova (Feminina)", gender: "F" },
];

export function AcademyAdminPanel() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isAdminOrTI, isGerente, isDiretor, tipoAcesso } = useUserAccessType();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("trainings");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  
  // User progress filters
  const [userNameFilter, setUserNameFilter] = useState("");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState<string>("all");
  const [userStoreFilter, setUserStoreFilter] = useState<string>("all");
  const [userProgressPage, setUserProgressPage] = useState(1);
  
  // Form state - focado em simulações práticas
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "simulacao", // Default: simulação por voz
    nivel: "intermediario",
    duracao_estimada_minutos: 5, // Default: 5min para voz
    prazo_padrao_dias: 7, // Prazo mais curto para práticas
    obrigatorio: false,
    publicoAlvo: [] as string[],
    aiPrompt: "",
    // Cenário de roleplay
    cenario: "",
    contextoSimulacao: "",
    objetivoSimulacao: "",
    // Voice simulation config
    personaNome: "",
    personaCargo: "",
    personaEmpresa: "",
    personaDescricao: "",
    personaGenero: "F",
    vozIA: "shimmer",
    // Prompt de sistema para a IA
    promptSistema: "",
    // Dados extras da persona
    objecoesPrincipais: [] as string[],
    gatilhosCompra: [] as string[],
  });

  // Update duration when type changes
  const handleTipoChange = (newTipo: string) => {
    const defaultDuracao = newTipo === "simulacao" ? 5 : 10;
    setFormData(prev => ({ 
      ...prev, 
      tipo: newTipo,
      duracao_estimada_minutos: defaultDuracao,
    }));
  };

  // Check if user has admin access
  const hasAdminAccess = isAdminOrTI || isGerente || isDiretor;

  // Fetch trainings and simulations (combined for admin panel)
  const { data: trainings, isLoading: loadingTrainings } = useAcademyTreinamentosAdmin();
  const { data: simulacoes, isLoading: loadingSimulacoes } = useAcademySimulacoes();
  const createTreinamento = useCreateTreinamento();
  const createSimulacao = useCreateSimulacao();
  const assignTreinamento = useAssignTreinamento();

  // Fetch empresas (stores)
  const { data: empresas } = useQuery({
    queryKey: ["academy-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome_empresa")
        .order("nome_empresa");
      
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess && isAdminOrTI,
  });

  // Fetch users for assignment and progress
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["academy-users", activeCompany?.id, isAdminOrTI],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome_completo, departamento, tipo_acesso, empresa_id, empresas:empresa_id(nome_empresa)")
        .eq("status", "Ativo")
        .order("nome_completo");
      
      // For managers, filter by their company
      if (!isAdminOrTI && activeCompany?.id) {
        query = query.eq("empresa_id", activeCompany.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  // Fetch user metrics
  const { data: userMetrics } = useQuery({
    queryKey: ["academy-all-metrics", activeCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_metricas_usuario")
        .select("*");
      
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  // Delete training mutation
  const deleteTrainingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("academy_treinamentos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-treinamentos"] });
    },
    onError: (error) => {
      toast.error("Erro ao excluir treinamento: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      tipo: "simulacao",
      nivel: "intermediario",
      duracao_estimada_minutos: 5, // Default 5min for voice
      prazo_padrao_dias: 7,
      obrigatorio: false,
      publicoAlvo: [],
      aiPrompt: "",
      cenario: "",
      contextoSimulacao: "",
      objetivoSimulacao: "",
      personaNome: "",
      personaCargo: "",
      personaEmpresa: "",
      personaDescricao: "",
      personaGenero: "F",
      vozIA: "shimmer",
      promptSistema: "",
      objecoesPrincipais: [],
      gatilhosCompra: [],
    });
  };

  const handleGenerateWithAI = async () => {
    if (!formData.aiPrompt) {
      toast.error("Digite uma descrição para gerar a simulação com IA.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("academy-generate-simulation", {
        body: {
          prompt: formData.aiPrompt,
          tipo: formData.tipo === "simulacao" ? "voz" : "texto",
          departamento: formData.publicoAlvo[0] || "Vendas Novos",
          nivel: formData.nivel,
        },
      });

      if (error) throw error;

      // Populate all form fields with AI-generated data
      setFormData(prev => ({
        ...prev,
        titulo: data?.titulo ?? prev.titulo,
        descricao: data?.descricao ?? prev.descricao,
        cenario: data?.cenario?.departamento ?? prev.cenario,
        contextoSimulacao: data?.cenario?.contexto ?? prev.contextoSimulacao,
        objetivoSimulacao: data?.cenario?.objetivo ?? prev.objetivoSimulacao,
        // Persona
        personaNome: data?.persona?.nome ?? prev.personaNome,
        personaCargo: data?.persona?.cargo ?? prev.personaCargo,
        personaEmpresa: data?.persona?.empresa ?? prev.personaEmpresa,
        personaDescricao: data?.persona?.descricao ?? prev.personaDescricao,
        personaGenero: data?.config_voz?.genero ?? prev.personaGenero,
        vozIA: data?.config_voz?.voz_openai ?? prev.vozIA,
        // Prompt sistema
        promptSistema: data?.prompt_sistema ?? prev.promptSistema,
        // Extra persona data
        objecoesPrincipais: data?.persona?.objecoes_principais ?? [],
        gatilhosCompra: data?.persona?.gatilhos_compra ?? [],
      }));

      toast.success("Simulação gerada com IA! Revise os campos e clique em 'Criar Simulação'.");
    } catch (err: any) {
      console.error("Erro ao gerar simulação com IA:", err);
      toast.error("Erro ao gerar com IA: " + (err?.message || "erro desconhecido"));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePlayVoicePreview = async (voiceId: string) => {
    // Stop current audio if playing
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
      setAudioRef(null);
    }

    // If clicking the same voice that's playing, just stop
    if (playingVoiceId === voiceId && isPlayingVoice) {
      setIsPlayingVoice(false);
      setPlayingVoiceId(null);
      return;
    }

    setIsPlayingVoice(true);
    setPlayingVoiceId(voiceId);

    try {
      const { data, error } = await supabase.functions.invoke("academy-voice-preview", {
        body: { voice: voiceId },
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlayingVoice(false);
          setPlayingVoiceId(null);
          setAudioRef(null);
        };

        audio.onerror = () => {
          setIsPlayingVoice(false);
          setPlayingVoiceId(null);
          setAudioRef(null);
          toast.error("Erro ao reproduzir áudio");
        };

        setAudioRef(audio);
        await audio.play();
      }
    } catch (err: any) {
      console.error("Erro ao gerar preview de voz:", err);
      toast.error("Erro ao gerar preview de voz");
      setIsPlayingVoice(false);
      setPlayingVoiceId(null);
    }
  };

  const handleCreateTraining = () => {
    if (!formData.titulo) {
      toast.error("O título é obrigatório.");
      return;
    }
    
    if (!formData.personaNome) {
      toast.error("O nome da persona é obrigatório.");
      return;
    }
    
    // Create simulation in academy_simulacoes table
    // DB constraint: tipo must be 'voz' or 'texto'
    const tipoSimulacao = formData.tipo === "simulacao" ? "voz" : "texto";
    
    // Build persona from form data with all fields
    const persona = {
      id: crypto.randomUUID(),
      nome: formData.personaNome,
      cargo: formData.personaCargo || "Cliente",
      empresa: formData.personaEmpresa || "Empresa",
      dificuldade: formData.nivel === "iniciante" ? "Fácil" : formData.nivel === "avancado" ? "Difícil" : "Médio",
      descricao: formData.personaDescricao || formData.descricao || "",
      objetivo: formData.objetivoSimulacao || "",
      objecoes_principais: formData.objecoesPrincipais,
      gatilhos_compra: formData.gatilhosCompra,
    };
    
    createSimulacao.mutate({
      titulo: formData.titulo,
      descricao: formData.descricao,
      tipo: tipoSimulacao as "voz" | "texto",
      cenario: formData.cenario,
      contexto: formData.contextoSimulacao,
      objetivo: formData.objetivoSimulacao,
      departamento: formData.publicoAlvo[0] || "Vendas Novos",
      personas: [persona],
      vozIA: formData.vozIA,
      promptSistema: formData.promptSistema,
      duracao_estimada_minutos: formData.duracao_estimada_minutos || (tipoSimulacao === "voz" ? 5 : 10),
    }, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        resetForm();
      }
    });
  };

  const handleAssignTraining = () => {
    if (!selectedTraining || !selectedUser) {
      toast.error("Selecione um usuário para atribuir o treinamento.");
      return;
    }
    
    // Calculate deadline based on selected date or default
    const dataLimite = assignmentDeadline || 
      (selectedTraining.conteudo?.prazo_padrao_dias 
        ? format(addDays(new Date(), selectedTraining.conteudo.prazo_padrao_dias), "yyyy-MM-dd")
        : format(addDays(new Date(), formData.prazo_padrao_dias), "yyyy-MM-dd"));
    
    assignTreinamento.mutate({
      treinamentoId: selectedTraining.id,
      userId: selectedUser,
      obrigatorio: true,
      dataLimite,
    }, {
      onSuccess: () => {
        setIsAssignModalOpen(false);
        setSelectedUser("");
        setAssignmentDeadline("");
      }
    });
  };

  const handleOpenDetails = (training: any) => {
    setSelectedTraining(training);
    setIsDetailsModalOpen(true);
  };

  const filteredTrainings = trainings?.filter(t => {
    const matchesSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || t.tipo === tipoFilter;
    const matchesNivel = nivelFilter === "all" || t.nivel === nivelFilter;
    return matchesSearch && matchesTipo && matchesNivel;
  });

  const hasTrainingFilters = searchTerm || tipoFilter !== "all" || nivelFilter !== "all";

  const clearTrainingFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setNivelFilter("all");
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "simulacao":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Simulação</Badge>;
      case "video":
        return <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">Vídeo</Badge>;
      case "audio":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Áudio</Badge>;
      case "texto":
      default:
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Texto</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "publicado":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Publicado</Badge>;
      case "rascunho":
        return <Badge variant="secondary">Rascunho</Badge>;
      case "arquivado":
        return <Badge variant="outline">Arquivado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!hasAdminAccess) {
    return (
      <div>
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <AcademyPageHeader
        title="Painel Admin"
        description="Gerencie treinamentos, progresso de usuários e atribuições."
        icon={<Settings className="h-6 w-6 text-sagaone-login-card" />}
        actions={
          <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Simulação
          </Button>
        }
      />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🎯 Criar Nova Simulação Prática
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Crie um cenário de roleplay para treinar habilidades reais através de prática.
              </p>
            </DialogHeader>
            
            {/* AI Generation Section */}
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-foreground">Gerar Cenário com IA</span>
                <Badge variant="outline" className="text-xs">beta</Badge>
              </div>
              <Textarea
                placeholder="Descreva o cenário de simulação que você quer criar. Ex: 'Cliente indeciso entre Compass e Renegade, está com pressa e quer fechar negócio hoje...'"
                value={formData.aiPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, aiPrompt: e.target.value }))}
                className="mb-3"
                rows={3}
              />
              <Button 
                type="button" 
                variant="outline" 
                className="gap-2"
                onClick={handleGenerateWithAI}
                disabled={isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando Cenário...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Gerar Simulação
                  </>
                )}
              </Button>
            </Card>
            
            <div className="grid gap-4">
              {/* Título e Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Título da Simulação *</label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ex: Negociação de SUV Premium"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de Simulação *</label>
                  <Select
                    value={formData.tipo}
                    onValueChange={handleTipoChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          <span className="flex items-center gap-2">
                            <span>{tipo.icon}</span>
                            {tipo.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Cenário */}
              <div>
                <label className="text-sm font-medium mb-1 block">Tipo de Cenário</label>
                <Select
                  value={formData.cenario}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cenario: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de cenário" />
                  </SelectTrigger>
                  <SelectContent>
                    {CENARIOS.map(cenario => (
                      <SelectItem key={cenario} value={cenario}>{cenario}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Contexto detalhado */}
              <div>
                <label className="text-sm font-medium mb-1 block">Contexto da Simulação</label>
                <Textarea
                  value={formData.contextoSimulacao || formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, contextoSimulacao: e.target.value, descricao: e.target.value }))}
                  placeholder="Descreva a situação que o vendedor irá enfrentar. Ex: O cliente chegou interessado no Compass Limited, mas está hesitante sobre o preço..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Objetivo do Treinamento</label>
                <Textarea
                  value={formData.objetivoSimulacao}
                  onChange={(e) => setFormData(prev => ({ ...prev, objetivoSimulacao: e.target.value }))}
                  placeholder="O que o vendedor deve aprender/praticar? Ex: Contornar objeções de preço, apresentar benefícios do produto..."
                  rows={2}
                />
              </div>
              
              {/* Dificuldade e Duração */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nível de Dificuldade</label>
                  <Select
                    value={formData.nivel}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, nivel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEIS.map(nivel => (
                        <SelectItem key={nivel.value} value={nivel.value}>{nivel.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Duração estimada (min) 
                    <span className="text-xs text-muted-foreground ml-1">
                      ({formData.tipo === "simulacao" ? "padrão: 5" : "padrão: 10"})
                    </span>
                  </label>
                  <Input
                    type="number"
                    value={formData.duracao_estimada_minutos || ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                      setFormData(prev => ({ ...prev, duracao_estimada_minutos: value }));
                    }}
                    min={1}
                    max={60}
                    placeholder={formData.tipo === "simulacao" ? "5" : "10"}
                  />
                </div>
              </div>

              {/* Prazo padrão */}
              <div>
                <label className="text-sm font-medium mb-1 block">Prazo para prática (dias)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Quando atribuído, o usuário terá este prazo para completar a simulação.
                </p>
                <Input
                  type="number"
                  value={formData.prazo_padrao_dias}
                  onChange={(e) => setFormData(prev => ({ ...prev, prazo_padrao_dias: parseInt(e.target.value) || 7 }))}
                  min={1}
                  max={30}
                />
              </div>

              {/* Configuração da Persona (Cliente IA) */}
              <Card className="p-4 border-primary/20 bg-primary/5">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  👤 Persona do Cliente (IA)
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure quem será o "cliente" na simulação. A IA vai interpretar esse personagem.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nome *</label>
                    <Input
                      value={formData.personaNome}
                      onChange={(e) => setFormData(prev => ({ ...prev, personaNome: e.target.value }))}
                      placeholder="Ex: Carlos, Maria..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cargo/Profissão</label>
                    <Input
                      value={formData.personaCargo}
                      onChange={(e) => setFormData(prev => ({ ...prev, personaCargo: e.target.value }))}
                      placeholder="Ex: Empresário, Médica..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Empresa/Contexto</label>
                    <Input
                      value={formData.personaEmpresa}
                      onChange={(e) => setFormData(prev => ({ ...prev, personaEmpresa: e.target.value }))}
                      placeholder="Ex: Clínica ABC, Autônomo..."
                    />
                  </div>
                </div>
                
                {/* Perfil/Descrição da Persona */}
                <div className="mt-4">
                  <label className="text-sm font-medium mb-1 block">Perfil Psicológico</label>
                  <Textarea
                    value={formData.personaDescricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, personaDescricao: e.target.value }))}
                    placeholder="Como o cliente se comporta? Quais são suas preocupações principais?"
                    rows={2}
                  />
                </div>
                
                {/* Voz IA - apenas para simulação por voz */}
                {formData.tipo === "simulacao" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Gênero da Voz</label>
                      <Select
                        value={formData.personaGenero}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, personaGenero: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="F">Feminino</SelectItem>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="N">Neutro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Voz da IA</label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.vozIA}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, vozIA: value }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VOZES_IA.map(voz => (
                              <SelectItem key={voz.value} value={voz.value}>{voz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handlePlayVoicePreview(formData.vozIA)}
                          disabled={isPlayingVoice && playingVoiceId !== formData.vozIA}
                          title={playingVoiceId === formData.vozIA && isPlayingVoice ? "Parar" : "Ouvir voz"}
                        >
                          {playingVoiceId === formData.vozIA && isPlayingVoice ? (
                            <Square className="h-4 w-4" />
                          ) : playingVoiceId === formData.vozIA ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clique no ícone de som para ouvir uma amostra da voz
                      </p>
                    </div>
                  </div>
                )}
              </Card>
              
              {/* Prompt de Sistema para IA */}
              <Card className="p-4 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  🤖 Prompt de Sistema (IA)
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Instruções detalhadas para a IA sobre como interpretar o personagem durante o roleplay.
                </p>
                <Textarea
                  value={formData.promptSistema}
                  onChange={(e) => setFormData(prev => ({ ...prev, promptSistema: e.target.value }))}
                  placeholder="Instruções para a IA: tom de voz, nível de resistência, pontos de dor, quando ceder, quando insistir, personalidade..."
                  rows={4}
                  className="font-mono text-sm"
                />
                {formData.objecoesPrincipais.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Objeções principais geradas:</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.objecoesPrincipais.map((obj, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{obj}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {formData.gatilhosCompra.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Gatilhos de compra:</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.gatilhosCompra.map((gat, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{gat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateTraining}
                disabled={!formData.titulo || !formData.personaNome || createSimulacao.isPending}
              >
                {createSimulacao.isPending ? "Criando..." : "Criar Simulação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar treinamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={nivelFilter} onValueChange={setNivelFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Nível" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos níveis</SelectItem>
              {NIVEIS.map(nivel => (
                <SelectItem key={nivel.value} value={nivel.value}>{nivel.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {hasTrainingFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearTrainingFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="trainings" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Treinamentos</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Progresso de Usuários</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trainings" className="mt-4">
          <Card>
            {loadingTrainings ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !filteredTrainings?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum treinamento encontrado.</p>
                <p className="text-sm mt-2">Crie um novo treinamento para começar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Nível</TableHead>
                      <TableHead className="hidden md:table-cell">Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrainings.map((training) => (
                      <TableRow key={training.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{training.titulo}</TableCell>
                        <TableCell>{getTipoBadge(training.tipo)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{training.nivel || "—"}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {training.duracao_estimada_minutos ? `${training.duracao_estimada_minutos}min` : "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(training.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDetails(training)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedTraining(training);
                                // Set default deadline based on training config
                                const conteudo = training.conteudo as Record<string, any> | null;
                                const defaultDays = conteudo?.prazo_padrao_dias || 30;
                                setAssignmentDeadline(format(addDays(new Date(), defaultDays), "yyyy-MM-dd"));
                                setIsAssignModalOpen(true);
                              }}
                              title="Atribuir a usuário"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            {isAdminOrTI && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Tem certeza que deseja excluir este treinamento?")) {
                                    deleteTrainingMutation.mutate(training.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          {/* User Progress Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={userNameFilter}
                  onChange={(e) => {
                    setUserNameFilter(e.target.value);
                    setUserProgressPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              
              <Select 
                value={userDepartmentFilter} 
                onValueChange={(v) => {
                  setUserDepartmentFilter(v);
                  setUserProgressPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos departamentos</SelectItem>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {isAdminOrTI && empresas && (
                <Select 
                  value={userStoreFilter} 
                  onValueChange={(v) => {
                    setUserStoreFilter(v);
                    setUserProgressPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.nome_empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Clear filters button */}
              {(userNameFilter || userDepartmentFilter !== "all" || userStoreFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUserNameFilter("");
                    setUserDepartmentFilter("all");
                    setUserStoreFilter("all");
                    setUserProgressPage(1);
                  }}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </Card>

          <Card>
            {loadingUsers ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (() => {
              // Filter users
              const filteredUsers = users?.filter(u => {
                const matchesName = !userNameFilter || 
                  u.nome_completo?.toLowerCase().includes(userNameFilter.toLowerCase());
                const matchesDept = userDepartmentFilter === "all" || 
                  u.departamento === userDepartmentFilter;
                const matchesStore = userStoreFilter === "all" || 
                  u.empresa_id === userStoreFilter;
                return matchesName && matchesDept && matchesStore;
              }) || [];
              
              // Pagination
              const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
              const startIndex = (userProgressPage - 1) * ITEMS_PER_PAGE;
              const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
              
              return !filteredUsers.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuário encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead className="hidden md:table-cell">Loja</TableHead>
                          <TableHead className="hidden sm:table-cell">Departamento</TableHead>
                          <TableHead>Tipo de Acesso</TableHead>
                          <TableHead className="text-center">Simulações</TableHead>
                          <TableHead className="text-center">Média</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((userProfile) => {
                          // Find user metrics
                          const metrics = userMetrics?.find(m => m.user_id === userProfile.id);
                          const mediaGeral = Number(metrics?.media_geral || 0);
                          const totalSimulacoes = metrics?.total_simulacoes_realizadas || 0;
                          
                          // Logic to determine Loja and Departamento correctly
                          // Some users have store names in 'departamento' field instead of empresa_id
                          const empresaNome = (userProfile.empresas as any)?.nome_empresa;
                          const deptoField = userProfile.departamento || "";
                          const tipoAcesso = userProfile.tipo_acesso || "—";
                          
                          // Check if departamento looks like a store name (e.g., "PRIMEIRA MÃO...")
                          const isStoreNameInDepto = deptoField.toUpperCase().includes("PRIMEIRA MÃO") || 
                                                     deptoField.toUpperCase().includes("SAGA") ||
                                                     deptoField.toUpperCase().includes("CONTAINER") ||
                                                     deptoField.toUpperCase().includes("PARK") ||
                                                     deptoField.toUpperCase().includes("JARDIM") ||
                                                     deptoField.toUpperCase().includes("SCIA") ||
                                                     deptoField.toUpperCase().includes("GAMA") ||
                                                     deptoField.toUpperCase().includes("OUTLET");
                          
                          // Loja: prioritize empresa, fallback to departamento if it looks like store name
                          const loja = empresaNome || (isStoreNameInDepto ? deptoField : "—");
                          
                          // Departamento: if depto contains store name, use tipo_acesso, otherwise use depto
                          const departamento = isStoreNameInDepto ? tipoAcesso : (deptoField || tipoAcesso);
                          
                          return (
                            <TableRow key={userProfile.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                                    {userProfile.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                                  </div>
                                  <span className="truncate max-w-[150px]">{userProfile.nome_completo || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm">
                                {loja}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{departamento}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{userProfile.tipo_acesso || "—"}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-medium">{totalSimulacoes}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                {totalSimulacoes > 0 ? (
                                  <Badge className={
                                    mediaGeral >= 7 
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                      : mediaGeral >= 5 
                                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  }>
                                    {mediaGeral.toFixed(1)}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(userProfile.id);
                                    setIsAssignModalOpen(true);
                                  }}
                                  className="gap-1"
                                >
                                  <UserPlus className="h-4 w-4" />
                                  <span className="hidden sm:inline">Atribuir</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t gap-3">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserProgressPage(p => Math.max(1, p - 1))}
                          disabled={userProgressPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">
                          {userProgressPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserProgressPage(p => Math.min(totalPages, p + 1))}
                          disabled={userProgressPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Training Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={(open) => {
        setIsAssignModalOpen(open);
        if (!open) {
          setAssignmentDeadline("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Treinamento</DialogTitle>
            <DialogDescription>
              Defina o usuário e o prazo para conclusão do treinamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedTraining && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTraining.titulo}</p>
                <div className="flex items-center gap-2 mt-1">
                  {getTipoBadge(selectedTraining.tipo)}
                  <span className="text-sm text-muted-foreground">• {selectedTraining.nivel || "—"}</span>
                  {selectedTraining.duracao_estimada_minutos && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedTraining.duracao_estimada_minutos}min
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Selecione um usuário *</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome_completo || u.id} - {u.departamento || "Sem departamento"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Prazo para conclusão *
              </Label>
              <Input
                type="date"
                value={assignmentDeadline}
                onChange={(e) => setAssignmentDeadline(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O usuário terá até esta data para concluir o treinamento.
              </p>
            </div>
            
            {!selectedTraining && trainings && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Selecione um treinamento</Label>
                <Select 
                  value={selectedTraining?.id || ""} 
                  onValueChange={(v) => {
                    const training = trainings.find(t => t.id === v);
                    setSelectedTraining(training);
                    if (training) {
                      const conteudo = training.conteudo as Record<string, any> | null;
                      const defaultDays = conteudo?.prazo_padrao_dias || 30;
                      setAssignmentDeadline(format(addDays(new Date(), defaultDays), "yyyy-MM-dd"));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar treinamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trainings.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignTraining}
              disabled={!selectedUser || !selectedTraining || !assignmentDeadline || assignTreinamento.isPending}
            >
              {assignTreinamento.isPending ? "Atribuindo..." : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Detalhes do Treinamento
            </DialogTitle>
          </DialogHeader>
          
          {selectedTraining && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Training Header */}
                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border">
                  <h2 className="text-xl font-bold text-foreground mb-2">{selectedTraining.titulo}</h2>
                  {selectedTraining.descricao && (
                    <p className="text-muted-foreground mb-3">{selectedTraining.descricao}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {getTipoBadge(selectedTraining.tipo)}
                    <Badge variant="outline">{selectedTraining.nivel || "Não definido"}</Badge>
                    {selectedTraining.duracao_estimada_minutos && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {selectedTraining.duracao_estimada_minutos} minutos
                      </span>
                    )}
                    {getStatusBadge(selectedTraining.status)}
                  </div>
                </div>

                {/* Training Configuration */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Configuração
                  </h3>
                  <Card className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Prazo padrão</p>
                        <p className="font-medium">
                          {(selectedTraining.conteudo as Record<string, any>)?.prazo_padrao_dias || 30} dias
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Obrigatório</p>
                        <p className="font-medium">{selectedTraining.obrigatorio ? "Sim" : "Não"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Criado em</p>
                        <p className="font-medium">
                          {format(new Date(selectedTraining.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Última atualização</p>
                        <p className="font-medium">
                          {format(new Date(selectedTraining.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Voice Configuration if simulation */}
                {selectedTraining.tipo === "simulacao" && selectedTraining.conteudo && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      🎙️ Configuração de Voz
                    </h3>
                    <Card className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Nome da Persona</p>
                          <p className="font-medium">
                            {(selectedTraining.conteudo as Record<string, any>)?.config_voz?.persona_nome || "Cliente"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Gênero</p>
                          <p className="font-medium">
                            {(selectedTraining.conteudo as Record<string, any>)?.config_voz?.persona_genero === "M" ? "Masculino" : 
                             (selectedTraining.conteudo as Record<string, any>)?.config_voz?.persona_genero === "F" ? "Feminino" : "Neutro"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Voz da IA</p>
                          <p className="font-medium capitalize">
                            {(selectedTraining.conteudo as Record<string, any>)?.config_voz?.voz_openai || "shimmer"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Modules placeholder */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Módulos / Conteúdo
                  </h3>
                  <Card className="p-6 text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      Este treinamento ainda não possui módulos configurados.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os módulos serão adicionados em uma próxima versão.
                    </p>
                  </Card>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button 
                    className="gap-2"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      // Set default deadline
                      const conteudo = selectedTraining.conteudo as Record<string, any> | null;
                      const defaultDays = conteudo?.prazo_padrao_dias || 30;
                      setAssignmentDeadline(format(addDays(new Date(), defaultDays), "yyyy-MM-dd"));
                      setIsAssignModalOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Atribuir a Usuário
                  </Button>
                  {selectedTraining.tipo === "simulacao" && (
                    <Button variant="outline" className="gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Testar Simulação
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

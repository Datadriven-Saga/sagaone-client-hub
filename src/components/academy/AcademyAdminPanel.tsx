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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useCompany } from "@/contexts/CompanyContext";
import { 
  useAcademyTreinamentos, 
  useCreateTreinamento, 
  useAssignTreinamento 
} from "@/hooks/useAcademyData";

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
const TIPOS = [
  { value: "curso", label: "Curso" },
  { value: "simulacao_voz", label: "Simulação por Voz" },
  { value: "simulacao_texto", label: "Simulação por Texto" },
  { value: "video", label: "Vídeo" },
  { value: "documento", label: "Documento" },
];

export function AcademyAdminPanel() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isAdminOrTI, isGerente, isDiretor, tipoAcesso } = useUserAccessType();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("trainings");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // User progress filters
  const [userNameFilter, setUserNameFilter] = useState("");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState<string>("all");
  const [userStoreFilter, setUserStoreFilter] = useState<string>("all");
  const [userProgressPage, setUserProgressPage] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "curso",
    nivel: "intermediario",
    duracao_estimada_minutos: 30,
    obrigatorio: false,
    publicoAlvo: [] as string[],
    aiPrompt: "",
  });

  // Check if user has admin access
  const hasAdminAccess = isAdminOrTI || isGerente || isDiretor;

  // Fetch trainings using the new hook
  const { data: trainings, isLoading: loadingTrainings } = useAcademyTreinamentos();
  const createTreinamento = useCreateTreinamento();
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
      tipo: "curso",
      nivel: "intermediario",
      duracao_estimada_minutos: 30,
      obrigatorio: false,
      publicoAlvo: [],
      aiPrompt: "",
    });
  };

  const handleGenerateWithAI = async () => {
    if (!formData.aiPrompt) {
      toast.error("Digite uma descrição para gerar o treinamento com IA.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("academy-generate-training", {
        body: {
          prompt: formData.aiPrompt,
          suggestedNivel: formData.nivel,
          suggestedTipo: formData.tipo,
        },
      });

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        titulo: data?.titulo ?? prev.titulo,
        descricao: data?.descricao ?? prev.descricao,
        tipo: data?.tipo ?? prev.tipo,
        nivel: data?.nivel ?? prev.nivel,
        duracao_estimada_minutos:
          typeof data?.duracao_estimada_minutos === "number"
            ? data.duracao_estimada_minutos
            : prev.duracao_estimada_minutos,
        publicoAlvo: Array.isArray(data?.publico_alvo) ? data.publico_alvo : prev.publicoAlvo,
      }));

      toast.success("Treinamento gerado com IA. Revise e clique em 'Criar Treinamento'.");
    } catch (err: any) {
      console.error("Erro ao gerar treinamento com IA:", err);
      toast.error("Erro ao gerar com IA: " + (err?.message || "erro desconhecido"));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCreateTraining = () => {
    if (!formData.titulo) {
      toast.error("O título é obrigatório.");
      return;
    }
    
    createTreinamento.mutate({
      titulo: formData.titulo,
      descricao: formData.descricao,
      tipo: formData.tipo,
      nivel: formData.nivel,
      duracao_estimada_minutos: formData.duracao_estimada_minutos,
      obrigatorio: formData.obrigatorio,
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
    
    assignTreinamento.mutate({
      treinamentoId: selectedTraining.id,
      userId: selectedUser,
      obrigatorio: true,
    }, {
      onSuccess: () => {
        setIsAssignModalOpen(false);
        setSelectedUser("");
      }
    });
  };

  const filteredTrainings = trainings?.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "simulacao_voz":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Voz</Badge>;
      case "simulacao_texto":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Texto</Badge>;
      case "video":
        return <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">Vídeo</Badge>;
      case "documento":
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Doc</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Curso</Badge>;
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
      <div className="p-6">
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
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Painel Admin</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie treinamentos, progresso de usuários e atribuições.
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Treinamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Treinamento</DialogTitle>
            </DialogHeader>
            
            {/* AI Generation Section */}
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-foreground">Gerar com IA</span>
                <Badge variant="outline" className="text-xs">beta</Badge>
              </div>
              <Textarea
                placeholder="Descreva o treinamento que você quer criar. Ex: 'Simulação de venda de veículo novo para cliente que está em dúvida entre comprar ou alugar...'"
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
                    Gerando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Gerar Treinamento
                  </>
                )}
              </Button>
            </Card>
            
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Título *</label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ex: Atendimento ao Cliente Premium"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo *</label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição</label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva o objetivo e conteúdo do treinamento..."
                  rows={3}
                />
              </div>
              
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
                  <label className="text-sm font-medium mb-1 block">Duração estimada (min)</label>
                  <Input
                    type="number"
                    value={formData.duracao_estimada_minutos}
                    onChange={(e) => setFormData(prev => ({ ...prev, duracao_estimada_minutos: parseInt(e.target.value) || 0 }))}
                    min={1}
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateTraining}
                disabled={!formData.titulo || createTreinamento.isPending}
              >
                {createTreinamento.isPending ? "Criando..." : "Criar Treinamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar treinamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                              onClick={() => {
                                setSelectedTraining(training);
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
                          
                          // Loja is the empresa, Departamento is the actual departamento field
                          const loja = (userProfile.empresas as any)?.nome_empresa || "—";
                          const departamento = userProfile.departamento || "—";
                          
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
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Treinamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedTraining && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTraining.titulo}</p>
                <p className="text-sm text-muted-foreground">
                  {getTipoBadge(selectedTraining.tipo)} • {selectedTraining.nivel || "—"}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Selecione um usuário</label>
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
            
            {!selectedTraining && trainings && (
              <div>
                <label className="text-sm font-medium mb-2 block">Selecione um treinamento</label>
                <Select 
                  value={selectedTraining?.id || ""} 
                  onValueChange={(v) => setSelectedTraining(trainings.find(t => t.id === v))}
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
              disabled={!selectedUser || (!selectedTraining && !selectedUser) || assignTreinamento.isPending}
            >
              {assignTreinamento.isPending ? "Atribuindo..." : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Building2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useCompany } from "@/contexts/CompanyContext";

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
  empresa_id: string | null;
  created_at: string;
}

interface UserProgress {
  id: string;
  user_id: string;
  treinamento_id: string;
  status: string;
  nota: number | null;
  tentativas: number;
  data_conclusao: string | null;
  profiles?: {
    nome_completo: string;
    departamento: string | null;
  };
  treinamentos?: {
    titulo: string;
    tipo: string;
  };
}

interface UserProfile {
  id: string;
  nome_completo: string;
  departamento: string | null;
  tipo_acesso: string;
  empresa_id: string | null;
  empresas?: {
    nome_empresa: string;
  } | null;
}

interface Empresa {
  id: string;
  nome_empresa: string;
}

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

export function AcademyAdminPanel() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isAdminOrTI, isGerente, isDiretor, tipoAcesso } = useUserAccessType();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("trainings");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  
  // User progress filters
  const [userNameFilter, setUserNameFilter] = useState("");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState<string>("all");
  const [userStoreFilter, setUserStoreFilter] = useState<string>("all");
  const [userProgressPage, setUserProgressPage] = useState(1);
  
  // Form state for creating/editing training
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "curso",
    departamento: "",
    dificuldade: "Médio",
    duracao_minutos: 30,
    nota_minima: 7,
    ativo: true,
    aiPrompt: "",
  });

  // Check if user has admin access
  const hasAdminAccess = isAdminOrTI || isGerente || isDiretor;

  // Fetch trainings
  const { data: trainings, isLoading: loadingTrainings } = useQuery({
    queryKey: ["academy-trainings", activeCompany],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamentos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Training[];
    },
    enabled: hasAdminAccess,
  });

  // Fetch user progress
  const { data: userProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ["academy-user-progress", activeCompany],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamento_progresso")
        .select(`
          *,
          profiles:user_id (
            nome_completo,
            departamento
          ),
          treinamentos:treinamento_id (
            titulo,
            tipo
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  // Fetch empresas (stores)
  const { data: empresas } = useQuery({
    queryKey: ["academy-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome_empresa")
        .order("nome_empresa");
      
      if (error) throw error;
      return data as Empresa[];
    },
    enabled: hasAdminAccess && isAdminOrTI,
  });

  // Fetch users for assignment and progress
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["academy-users", activeCompany, isAdminOrTI],
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
      return data as UserProfile[];
    },
    enabled: hasAdminAccess,
  });

  // Create training mutation
  const createTrainingMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const empresaId = isAdminOrTI ? null : activeCompany?.id || null;
      const { error } = await supabase.from("treinamentos").insert([{
        titulo: data.titulo,
        descricao: data.descricao || null,
        tipo: data.tipo,
        departamento: data.departamento || null,
        dificuldade: data.dificuldade,
        duracao_minutos: data.duracao_minutos,
        nota_minima: data.nota_minima,
        ativo: data.ativo,
        empresa_id: empresaId,
        criado_por: user?.id,
      }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-trainings"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar treinamento: " + error.message);
    },
  });

  // Delete training mutation
  const deleteTrainingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("treinamentos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["academy-trainings"] });
    },
    onError: (error) => {
      toast.error("Erro ao excluir treinamento: " + error.message);
    },
  });

  // Assign mandatory training mutation
  const assignTrainingMutation = useMutation({
    mutationFn: async ({ trainingId, userId, prazo }: { trainingId: string; userId: string; prazo?: string }) => {
      const empresaId = activeCompany?.id || null;
      const { error } = await supabase.from("treinamento_obrigatorios").insert([{
        treinamento_id: trainingId,
        user_id: userId,
        atribuido_por: user?.id || "",
        prazo: prazo || null,
        empresa_id: empresaId,
      }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treinamento atribuído com sucesso!");
      setIsAssignModalOpen(false);
      setSelectedUser("");
    },
    onError: (error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Este treinamento já foi atribuído a este usuário.");
      } else {
        toast.error("Erro ao atribuir treinamento: " + error.message);
      }
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      tipo: "curso",
      departamento: "",
      dificuldade: "Médio",
      duracao_minutos: 30,
      nota_minima: 7,
      ativo: true,
      aiPrompt: "",
    });
  };

  const handleGenerateWithAI = () => {
    if (!formData.aiPrompt) {
      toast.error("Digite uma descrição para gerar o treinamento com IA.");
      return;
    }
    
    // TODO: Integrate with AI service
    toast.info("Geração com IA será implementada em breve!");
    
    // For now, populate with mock data based on prompt
    setFormData(prev => ({
      ...prev,
      titulo: `Treinamento: ${prev.aiPrompt.slice(0, 50)}...`,
      descricao: prev.aiPrompt,
    }));
  };

  const filteredTrainings = trainings?.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProgress = userProgress?.filter(p => {
    const userName = (p.profiles as any)?.nome_completo?.toLowerCase() || "";
    const trainingName = (p.treinamentos as any)?.titulo?.toLowerCase() || "";
    return userName.includes(searchTerm.toLowerCase()) || trainingName.includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "em_andamento":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Em Andamento</Badge>;
      case "reprovado":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Reprovado</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "voz":
        return <Badge className="bg-purple-100 text-purple-700">Voz</Badge>;
      case "texto":
        return <Badge className="bg-blue-100 text-blue-700">Texto</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">Curso</Badge>;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
          <p className="text-muted-foreground">
            Gerencie treinamentos, progresso de usuários e atribuições obrigatórias.
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
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-foreground">Gerar com IA</span>
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
              >
                <Wand2 className="h-4 w-4" />
                Gerar Treinamento
              </Button>
            </Card>
            
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem value="voz">Simulação por Voz</SelectItem>
                      <SelectItem value="texto">Simulação por Texto</SelectItem>
                      <SelectItem value="curso">Curso</SelectItem>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Departamento</label>
                  <Select
                    value={formData.departamento}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, departamento: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os departamentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os departamentos</SelectItem>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Dificuldade *</label>
                  <Select
                    value={formData.dificuldade}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, dificuldade: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fácil">Fácil</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Difícil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Duração (minutos)</label>
                  <Input
                    type="number"
                    value={formData.duracao_minutos}
                    onChange={(e) => setFormData(prev => ({ ...prev, duracao_minutos: parseInt(e.target.value) || 0 }))}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nota Mínima</label>
                  <Input
                    type="number"
                    value={formData.nota_minima}
                    onChange={(e) => setFormData(prev => ({ ...prev, nota_minima: parseInt(e.target.value) || 0 }))}
                    min={0}
                    max={10}
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createTrainingMutation.mutate(formData)}
                disabled={!formData.titulo || createTrainingMutation.isPending}
              >
                {createTrainingMutation.isPending ? "Criando..." : "Criar Treinamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar treinamentos ou usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[200px]">
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
        <TabsList>
          <TabsTrigger value="trainings" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Treinamentos
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <Users className="h-4 w-4" />
            Progresso de Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trainings" className="mt-4">
          <Card>
            {loadingTrainings ? (
              <div className="p-8 text-center text-muted-foreground">
                Carregando treinamentos...
              </div>
            ) : !filteredTrainings?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum treinamento encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Dificuldade</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrainings.map((training) => (
                    <TableRow key={training.id}>
                      <TableCell className="font-medium">{training.titulo}</TableCell>
                      <TableCell>{getTipoBadge(training.tipo)}</TableCell>
                      <TableCell>{training.departamento || "Todos"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{training.dificuldade}</Badge>
                      </TableCell>
                      <TableCell>{training.duracao_minutos}min</TableCell>
                      <TableCell>
                        {training.ativo ? (
                          <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTraining(training);
                              setIsAssignModalOpen(true);
                            }}
                            title="Atribuir a usuário"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTraining(training);
                              setFormData({
                                titulo: training.titulo,
                                descricao: training.descricao || "",
                                tipo: training.tipo,
                                departamento: training.departamento || "",
                                dificuldade: training.dificuldade,
                                duracao_minutos: training.duracao_minutos || 30,
                                nota_minima: training.nota_minima || 7,
                                ativo: training.ativo ?? true,
                                aiPrompt: "",
                              });
                              setIsCreateModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
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
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todos departamentos</SelectItem>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {isAdminOrTI && (
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
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {empresas?.map(emp => (
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
              <div className="p-8 text-center text-muted-foreground">
                Carregando usuários...
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
                  Nenhum usuário encontrado com os filtros aplicados.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Tipo de Acesso</TableHead>
                        <TableHead>Concluídos</TableHead>
                        <TableHead>Em Andamento</TableHead>
                        <TableHead>Média</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((userProfile) => {
                        // Calculate user's progress stats
                        const userProgressData = userProgress?.filter(p => p.user_id === userProfile.id) || [];
                        const concluidos = userProgressData.filter(p => p.status === "concluido").length;
                        const emAndamento = userProgressData.filter(p => p.status === "em_andamento").length;
                        const notasValidas = userProgressData.filter(p => p.nota !== null).map(p => p.nota as number);
                        const mediaNota = notasValidas.length > 0 
                          ? (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(1)
                          : "—";
                        
                        return (
                          <TableRow key={userProfile.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                  {userProfile.nome_completo?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                                </div>
                                <span>{userProfile.nome_completo || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {(userProfile.empresas as any)?.nome_empresa || "—"}
                            </TableCell>
                            <TableCell>{userProfile.departamento || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{userProfile.tipo_acesso || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-green-600">{concluidos}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-yellow-600">{emAndamento}</span>
                            </TableCell>
                            <TableCell>
                              {mediaNota !== "—" ? (
                                <Badge className={
                                  parseFloat(mediaNota) >= 7 
                                    ? "bg-green-100 text-green-700" 
                                    : parseFloat(mediaNota) >= 5 
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                }>
                                  {mediaNota}/10
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {userProgressData.length === 0 ? (
                                <Badge variant="outline" className="text-muted-foreground">Sem atividade</Badge>
                              ) : concluidos > 0 ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Em progresso
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length.toLocaleString("pt-BR")} usuários
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserProgressPage(p => Math.max(1, p - 1))}
                          disabled={userProgressPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">
                          Página {userProgressPage} de {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserProgressPage(p => Math.min(totalPages, p + 1))}
                          disabled={userProgressPage === totalPages}
                        >
                          Próximo
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
            <DialogTitle>Atribuir Treinamento Obrigatório</DialogTitle>
          </DialogHeader>
          
          {selectedTraining && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTraining.titulo}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTraining.descricao?.slice(0, 100)}...
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Selecione o Usuário</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome_completo} - {u.departamento || "Sem departamento"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedTraining && selectedUser) {
                  assignTrainingMutation.mutate({
                    trainingId: selectedTraining.id,
                    userId: selectedUser,
                  });
                }
              }}
              disabled={!selectedUser || assignTrainingMutation.isPending}
            >
              {assignTrainingMutation.isPending ? "Atribuindo..." : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

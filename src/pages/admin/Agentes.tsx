import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  RefreshCw, 
  Building2, 
  Server, 
  Search, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  X, 
  Save,
  Store,
  Phone,
  Plus,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgenteDetalhes } from "@/components/AgenteDetalhes";

interface AgenteWebhook {
  id?: string;
  nome: string;
  telefone: string;
  marca?: string;
  loja?: string;
  empresa_id?: string;
  ativo?: boolean;
  instancia?: string;
  evo_token?: string;
  cw_token_maia?: string;
  num_maia?: string;
  uf?: string;
  // Outros campos que podem vir do webhook
  [key: string]: any;
}

interface Empresa {
  id: string;
  nome_empresa: string;
}

interface InstanciaData {
  num_maia: string;
  marca: string;
  uf: string;
  instancia: string;
  evo_token: string;
  id_numero_meta: string;
  criado_em: string;
  tb_histories: string | null;
  cw_inbox: string | null;
  waba: string | null;
  meta_app_id: string | null;
  agente: string | null;
  cw_token_maia: string | null;
  [key: string]: any;
}

interface AgenteLocal {
  id: string;
  nome: string;
  persona: string;
  cerebro: string;
  telefone: string;
  dealer_id?: string;
  foto_url?: string;
  ativo: boolean;
}

export default function AdminAgentes() {
  const { toast } = useToast();
  const { isDepartamentoTI, isAdminOrTI, loading: accessLoading } = useUserAccessType();

  const [loading, setLoading] = useState(false);
  const [agentes, setAgentes] = useState<AgenteWebhook[]>([]);
  const [filteredAgentes, setFilteredAgentes] = useState<AgenteWebhook[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAgente, setSelectedAgente] = useState<AgenteWebhook | null>(null);
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [loadingInstancia, setLoadingInstancia] = useState(false);
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any> | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // Modal para atribuir agente a empresa
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [agenteToAssign, setAgenteToAssign] = useState<AgenteWebhook | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  // Criar novo agente
  const [showCreateAgente, setShowCreateAgente] = useState(false);
  const [agenteEdicao, setAgenteEdicao] = useState<AgenteLocal | null>(null);

  const canAccess = isDepartamentoTI && isAdminOrTI;

  // Determinar tipo do agente (Maia ou Outro)
  const getAgenteTipo = (agente: AgenteWebhook): string => {
    const nome = (agente.nome || "").toLowerCase();
    return nome.includes("maia") ? "Maia" : "Outro";
  };

  // Determinar número a exibir
  const getAgenteNumero = (agente: AgenteWebhook): string => {
    const tipo = getAgenteTipo(agente);
    if (tipo === "Maia") {
      return agente.num_maia || agente.telefone || "N/A";
    }
    return agente.telefone || "N/A";
  };

  const carregarAgentes = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/busca-dados-agentes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      console.log('Agentes do webhook:', data);
      
      const agentesArray = Array.isArray(data) ? data : [data];
      setAgentes(agentesArray);
      setFilteredAgentes(agentesArray);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast({
        title: "Erro ao carregar agentes",
        description: "Não foi possível carregar a lista de agentes do webhook",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome_empresa')
        .order('nome_empresa');

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    filterAgentes(term, filterEmpresa);
  };

  const handleFilterEmpresa = (empresaId: string) => {
    setFilterEmpresa(empresaId);
    filterAgentes(searchTerm, empresaId);
  };

  const filterAgentes = (term: string, empresaId: string) => {
    let filtered = [...agentes];
    
    if (term) {
      const lowerTerm = term.toLowerCase();
      filtered = filtered.filter(a => 
        a.nome?.toLowerCase().includes(lowerTerm) ||
        a.telefone?.toLowerCase().includes(lowerTerm) ||
        a.marca?.toLowerCase().includes(lowerTerm) ||
        a.loja?.toLowerCase().includes(lowerTerm) ||
        a.uf?.toLowerCase().includes(lowerTerm)
      );
    }
    
    if (empresaId && empresaId !== "all") {
      filtered = filtered.filter(a => a.empresa_id === empresaId);
    }
    
    setFilteredAgentes(filtered);
    setCurrentPage(1); // Reset para primeira página ao filtrar
  };

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredAgentes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAgentes = filteredAgentes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCopyToClipboard = async (e: React.MouseEvent, text: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch (err) {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    }
  };

  const handleOpenDetails = async (agente: AgenteWebhook) => {
    setSelectedAgente(agente);
    setInstanciaData(null);
    setEditMode(false);
    setShowEvoToken(false);
    setShowCwToken(false);
    setActiveTab("info");
    setShowDetailsModal(true);

    if (agente.telefone) {
      await buscarInstancia(agente.telefone);
    }
  };

  const buscarInstancia = async (telefone: string) => {
    try {
      setLoadingInstancia(true);
      
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telefone })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && Object.keys(data).length > 0 && data.num_maia) {
        setInstanciaData(data);
      } else {
        setInstanciaData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar instância:', error);
      setInstanciaData(null);
    } finally {
      setLoadingInstancia(false);
    }
  };

  const handleEditarDados = () => {
    // Combina dados do agente com dados da instância para edição
    const dadosParaEditar = {
      ...selectedAgente,
      ...(instanciaData || {})
    };
    setEditedData(dadosParaEditar);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!editedData || !selectedAgente?.telefone) return;

    try {
      setSavingEdit(true);

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/atualiza-instancias_evo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telefone: selectedAgente.telefone,
          ...editedData
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      toast({
        title: "Dados atualizados",
        description: "Os dados foram salvos com sucesso"
      });

      // Atualizar dados locais
      if (instanciaData) {
        setInstanciaData({ ...instanciaData, ...editedData });
      }
      setEditMode(false);
      carregarAgentes();
    } catch (error) {
      console.error('Erro ao salvar edições:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedData(null);
  };

  const handleEditFieldChange = (field: string, value: string) => {
    if (editedData) {
      setEditedData({
        ...editedData,
        [field]: value
      });
    }
  };

  const handleOpenAssignModal = (e: React.MouseEvent, agente: AgenteWebhook) => {
    e.stopPropagation();
    setAgenteToAssign(agente);
    setSelectedEmpresaId(agente.empresa_id || "");
    setShowAssignModal(true);
  };

  const handleAssignAgente = async () => {
    if (!agenteToAssign) return;

    try {
      toast({
        title: "Agente atribuído",
        description: `Agente ${agenteToAssign.nome} foi atribuído à empresa selecionada`
      });
      
      setShowAssignModal(false);
      setAgenteToAssign(null);
      carregarAgentes();
    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      toast({
        title: "Erro ao atribuir",
        description: "Não foi possível atribuir o agente à empresa",
        variant: "destructive"
      });
    }
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedAgente(null);
    setInstanciaData(null);
    setEditMode(false);
    setEditedData(null);
  };

  const handleCreateAgente = () => {
    setAgenteEdicao(null);
    setShowCreateAgente(true);
  };

  const handleCloseCreateAgente = () => {
    setShowCreateAgente(false);
    setAgenteEdicao(null);
    carregarAgentes();
  };

  useEffect(() => {
    if (canAccess) {
      carregarAgentes();
      carregarEmpresas();
    }
  }, [canAccess]);

  if (accessLoading) {
    return (
      <DashboardLayout title="Agentes - Administração">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout title="Agentes - Administração">
        <Alert variant="destructive">
          <AlertDescription>
            Acesso restrito. Apenas usuários do departamento TI com tipo de acesso TI ou Administrador podem acessar esta página.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  // Mostrar tela de criar/editar agente
  if (showCreateAgente) {
    return (
      <AgenteDetalhes 
        agente={agenteEdicao}
        onClose={handleCloseCreateAgente}
      />
    );
  }

  const renderTokenField = (
    label: string,
    value: string | null,
    showToken: boolean,
    onToggle: () => void
  ) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm bg-muted px-2 py-1 rounded truncate">
          {showToken ? (value || "N/A") : "••••••••••••••••"}
        </code>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        {value && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={(e) => handleCopyToClipboard(e, value, label)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  // Campos a serem exibidos no modal
  const camposExibicao = [
    { key: "nome", label: "Nome" },
    { key: "telefone", label: "Telefone" },
    { key: "num_maia", label: "Número Maia" },
    { key: "marca", label: "Marca" },
    { key: "loja", label: "Loja" },
    { key: "uf", label: "UF" },
    { key: "instancia", label: "Instância" },
    { key: "id_numero_meta", label: "ID Número Meta" },
    { key: "waba", label: "WABA" },
    { key: "meta_app_id", label: "Meta App ID" },
    { key: "tb_histories", label: "TB Histories" },
    { key: "cw_inbox", label: "CW Inbox" },
    { key: "criado_em", label: "Criado em" },
    { key: "agente", label: "Agente" },
  ];

  return (
    <DashboardLayout title="Agentes - Administração">
      <ScrollIndicator className="flex-1 h-full">
        <div className="space-y-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Agentes de IA</h1>
              <p className="text-muted-foreground">
                Gerencie todos os agentes de todas as lojas
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateAgente}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Agente
              </Button>
              <Button onClick={carregarAgentes} disabled={loading} variant="outline">
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone, loja, estado..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-64">
                  <Select value={filterEmpresa} onValueChange={handleFilterEmpresa}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as empresas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {empresas.map((empresa) => (
                        <SelectItem key={empresa.id} value={empresa.id}>
                          {empresa.nome_empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Agentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agentes ({filteredAgentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAgentes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum agente encontrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAgentes.map((agente, index) => (
                      <TableRow 
                        key={agente.id || index} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDetails(agente)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span>{agente.loja || agente.marca || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{agente.uf || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{getAgenteTipo(agente)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{getAgenteNumero(agente)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={agente.ativo !== false ? "default" : "secondary"}>
                            {agente.ativo !== false ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleOpenAssignModal(e, agente)}
                          >
                            <Building2 className="h-4 w-4 mr-1" />
                            Atribuir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredAgentes.length)} de {filteredAgentes.length} agentes
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 7) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, arr) => (
                          <span key={page} className="flex items-center">
                            {index > 0 && arr[index - 1] !== page - 1 && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        ))
                      }
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Detalhes do Agente */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {getAgenteTipo(selectedAgente)} - {selectedAgente?.loja || selectedAgente?.marca || "Agente"}
                </DialogTitle>
                <DialogDescription>
                  Detalhes completos do agente
                </DialogDescription>
              </DialogHeader>

              {selectedAgente && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
                    <TabsTrigger value="instancia" className="flex-1">Instância</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-4 mt-4">
                    <div className="flex justify-end">
                      {!editMode ? (
                        <Button size="sm" variant="outline" onClick={handleEditarDados}>
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      )}
                    </div>

                    {editMode && editedData ? (
                      <div className="grid grid-cols-2 gap-4">
                        {camposExibicao.map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <Input
                              value={editedData[key] || ""}
                              onChange={(e) => handleEditFieldChange(key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {camposExibicao.map(({ key, label }) => {
                          const value = selectedAgente[key] || instanciaData?.[key] || null;
                          if (!value) return null;
                          return (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <p className="font-medium">{value}</p>
                            </div>
                          );
                        })}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <Badge variant={selectedAgente.ativo !== false ? "default" : "secondary"}>
                            {selectedAgente.ativo !== false ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="instancia" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Instância Evolution
                      </h4>
                      {instanciaData && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectedAgente.telefone && buscarInstancia(selectedAgente.telefone)}
                          disabled={loadingInstancia}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${loadingInstancia ? 'animate-spin' : ''}`} />
                          Atualizar
                        </Button>
                      )}
                    </div>

                    {loadingInstancia ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !instanciaData ? (
                      <p className="text-muted-foreground text-sm py-4">
                        Nenhuma instância encontrada para este agente
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Número Maia</Label>
                            <p className="text-sm">{instanciaData.num_maia}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Instância</Label>
                            <p className="text-sm">{instanciaData.instancia}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Marca</Label>
                            <p className="text-sm">{instanciaData.marca}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">UF</Label>
                            <p className="text-sm">{instanciaData.uf}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">ID Número Meta</Label>
                            <p className="text-sm">{instanciaData.id_numero_meta || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">WABA</Label>
                            <p className="text-sm">{instanciaData.waba || "N/A"}</p>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          {renderTokenField(
                            "Evo Token",
                            instanciaData.evo_token,
                            showEvoToken,
                            () => setShowEvoToken(!showEvoToken)
                          )}

                          {renderTokenField(
                            "CW Token Maia",
                            instanciaData.cw_token_maia,
                            showCwToken,
                            () => setShowCwToken(!showCwToken)
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDetailsModal}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Atribuição de Empresa */}
          <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atribuir Agente à Empresa</DialogTitle>
                <DialogDescription>
                  Selecione a empresa para atribuir o agente "{agenteToAssign?.nome}"
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>Empresa</Label>
                <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma (remover atribuição)</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAssignAgente}>
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
}

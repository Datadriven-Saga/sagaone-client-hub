import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
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
  Plus,
  Trash2
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

  // Detalhes do agente selecionado
  const [selectedAgente, setSelectedAgente] = useState<AgenteWebhook | null>(null);
  const [instanciaData, setInstanciaData] = useState<InstanciaData | null>(null);
  const [loadingInstancia, setLoadingInstancia] = useState(false);
  const [showEvoToken, setShowEvoToken] = useState(false);
  const [showCwToken, setShowCwToken] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<InstanciaData | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal para atribuir agente a empresa
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [agenteToAssign, setAgenteToAssign] = useState<AgenteWebhook | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  const canAccess = isDepartamentoTI && isAdminOrTI;

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
        a.loja?.toLowerCase().includes(lowerTerm)
      );
    }
    
    if (empresaId && empresaId !== "all") {
      filtered = filtered.filter(a => a.empresa_id === empresaId);
    }
    
    setFilteredAgentes(filtered);
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

  const handleSelectAgente = async (agente: AgenteWebhook) => {
    setSelectedAgente(agente);
    setInstanciaData(null);
    setEditMode(false);
    setShowEvoToken(false);
    setShowCwToken(false);

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

  const handleEditarInstancia = () => {
    if (instanciaData) {
      setEditedData({ ...instanciaData });
      setEditMode(true);
    }
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
        title: "Instância atualizada",
        description: "Os dados da instância foram salvos com sucesso"
      });

      setInstanciaData(editedData);
      setEditMode(false);
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

  const handleEditFieldChange = (field: keyof InstanciaData, value: string) => {
    if (editedData) {
      setEditedData({
        ...editedData,
        [field]: value
      });
    }
  };

  const handleOpenAssignModal = (agente: AgenteWebhook) => {
    setAgenteToAssign(agente);
    setSelectedEmpresaId(agente.empresa_id || "");
    setShowAssignModal(true);
  };

  const handleAssignAgente = async () => {
    if (!agenteToAssign) return;

    try {
      // Aqui você pode implementar a lógica para atribuir o agente à empresa
      // Por exemplo, chamando uma API ou atualizando o banco de dados
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
            <Button onClick={carregarAgentes} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Nome, telefone, marca..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-64">
                  <Label>Empresa</Label>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Agentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Lista de Agentes ({filteredAgentes.length})
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
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredAgentes.map((agente, index) => (
                      <div
                        key={agente.id || index}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedAgente?.telefone === agente.telefone
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => handleSelectAgente(agente)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{agente.nome}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {agente.telefone}
                            </p>
                            {agente.marca && (
                              <div className="flex items-center gap-1 mt-1">
                                <Store className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {agente.marca} {agente.loja && `- ${agente.loja}`}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={agente.ativo !== false ? "default" : "secondary"}>
                              {agente.ativo !== false ? "Ativo" : "Inativo"}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssignModal(agente);
                              }}
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalhes do Agente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {selectedAgente ? "Detalhes do Agente" : "Selecione um Agente"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedAgente ? (
                  <p className="text-muted-foreground text-center py-8">
                    Clique em um agente para ver os detalhes e instância
                  </p>
                ) : (
                  <div className="space-y-6">
                    {/* Info do Agente */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">{selectedAgente.nome}</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Telefone:</span>
                          <p>{selectedAgente.telefone || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Marca:</span>
                          <p>{selectedAgente.marca || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Loja:</span>
                          <p>{selectedAgente.loja || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={selectedAgente.ativo !== false ? "default" : "secondary"} className="ml-2">
                            {selectedAgente.ativo !== false ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Instância */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">Instância Evolution</h4>
                        {instanciaData && !editMode && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => selectedAgente.telefone && buscarInstancia(selectedAgente.telefone)}
                              disabled={loadingInstancia}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${loadingInstancia ? 'animate-spin' : ''}`} />
                              Atualizar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleEditarInstancia}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </div>
                        )}
                        {editMode && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={savingEdit}
                            >
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

                      {loadingInstancia ? (
                        <div className="flex items-center justify-center py-6">
                          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : !instanciaData ? (
                        <p className="text-muted-foreground text-sm">
                          Nenhuma instância encontrada para este agente
                        </p>
                      ) : editMode && editedData ? (
                        <div className="grid grid-cols-1 gap-3">
                          {Object.entries(editedData).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs">{key}</Label>
                              <Input
                                value={value || ""}
                                onChange={(e) => handleEditFieldChange(key as keyof InstanciaData, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Número Maia:</span>
                              <p>{instanciaData.num_maia}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Instância:</span>
                              <p>{instanciaData.instancia}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Marca:</span>
                              <p>{instanciaData.marca}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">UF:</span>
                              <p>{instanciaData.uf}</p>
                            </div>
                          </div>

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
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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

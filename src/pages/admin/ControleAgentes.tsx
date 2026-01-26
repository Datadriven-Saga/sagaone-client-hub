import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  RefreshCw,
  X,
  Bot,
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Rocket,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type StatusAgenteEmpresa = 'ativo' | 'inativo' | 'em_desenvolvimento' | 'em_rollout' | 'pendente';

interface AgenteEmpresa {
  id: string;
  agente_id: string;
  empresa_id: string;
  status: StatusAgenteEmpresa;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
  agentes_ia: {
    id: string;
    nome: string;
    telefone: string | null;
    ativo: boolean;
    foto_url: string | null;
  };
  empresas: {
    id: string;
    nome_empresa: string;
    marca: string | null;
    uf: string | null;
    cidade: string | null;
  };
}

interface Agente {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
}

interface Empresa {
  id: string;
  nome_empresa: string;
  marca: string | null;
  uf: string | null;
  cidade: string | null;
}

const statusConfig: Record<StatusAgenteEmpresa, { label: string; color: string; icon: React.ElementType }> = {
  ativo: { label: "Ativo", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  inativo: { label: "Inativo", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
  em_desenvolvimento: { label: "Em Desenvolvimento", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  em_rollout: { label: "Em Roll Out", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Rocket },
  pendente: { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: AlertCircle },
};

const ControleAgentes = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<AgenteEmpresa[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("todos");
  const [selectedAgente, setSelectedAgente] = useState("todos");
  const [selectedMarca, setSelectedMarca] = useState("todos");
  const [selectedUf, setSelectedUf] = useState("todos");
  const [selectedStatus, setSelectedStatus] = useState("todos");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgenteEmpresa | null>(null);
  const [formData, setFormData] = useState({
    agente_id: "",
    empresa_id: "",
    status: "pendente" as StatusAgenteEmpresa,
    observacoes: ""
  });
  const [saving, setSaving] = useState(false);

  // Filter options
  const filterOptions = useMemo(() => {
    const marcas = [...new Set(empresas.map(e => e.marca).filter(Boolean) as string[])].sort();
    const ufs = [...new Set(empresas.map(e => e.uf).filter(Boolean) as string[])].sort();
    return { marcas, ufs };
  }, [empresas]);

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.agentes_ia?.nome?.toLowerCase().includes(term) ||
          item.empresas?.nome_empresa?.toLowerCase().includes(term) ||
          item.empresas?.cidade?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (selectedEmpresa !== "todos" && item.empresa_id !== selectedEmpresa) return false;
      if (selectedAgente !== "todos" && item.agente_id !== selectedAgente) return false;
      if (selectedMarca !== "todos" && item.empresas?.marca !== selectedMarca) return false;
      if (selectedUf !== "todos" && item.empresas?.uf !== selectedUf) return false;
      if (selectedStatus !== "todos" && item.status !== selectedStatus) return false;

      return true;
    });
  }, [data, searchTerm, selectedEmpresa, selectedAgente, selectedMarca, selectedUf, selectedStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: data.length,
    ativos: data.filter(d => d.status === 'ativo').length,
    emDesenvolvimento: data.filter(d => d.status === 'em_desenvolvimento').length,
    emRollout: data.filter(d => d.status === 'em_rollout').length,
    inativos: data.filter(d => d.status === 'inativo').length,
  }), [data]);

  const hasActiveFilters = selectedEmpresa !== "todos" || selectedAgente !== "todos" ||
    selectedMarca !== "todos" || selectedUf !== "todos" || selectedStatus !== "todos" || searchTerm;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedEmpresa("todos");
    setSelectedAgente("todos");
    setSelectedMarca("todos");
    setSelectedUf("todos");
    setSelectedStatus("todos");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agenteEmpresasRes, agentesRes, empresasRes] = await Promise.all([
        supabase
          .from("agente_empresas")
          .select(`
            *,
            agentes_ia:agente_id(id, nome, telefone, ativo, foto_url),
            empresas:empresa_id(id, nome_empresa, marca, uf, cidade)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("agentes_ia")
          .select("id, nome, telefone, ativo")
          .order("nome"),
        supabase
          .from("empresas")
          .select("id, nome_empresa, marca, uf, cidade")
          .order("nome_empresa")
      ]);

      if (agenteEmpresasRes.error) throw agenteEmpresasRes.error;
      if (agentesRes.error) throw agentesRes.error;
      if (empresasRes.error) throw empresasRes.error;

      setData((agenteEmpresasRes.data || []) as AgenteEmpresa[]);
      setAgentes(agentesRes.data || []);
      setEmpresas(empresasRes.data || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (item?: AgenteEmpresa) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        agente_id: item.agente_id,
        empresa_id: item.empresa_id,
        status: item.status,
        observacoes: item.observacoes || ""
      });
    } else {
      setEditingItem(null);
      setFormData({
        agente_id: "",
        empresa_id: "",
        status: "pendente",
        observacoes: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.agente_id || !formData.empresa_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o agente e a empresa.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("agente_empresas")
          .update({
            status: formData.status,
            observacoes: formData.observacoes || null
          })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso!" });
      } else {
        // Check if assignment already exists
        const { data: existing } = await supabase
          .from("agente_empresas")
          .select("id")
          .eq("agente_id", formData.agente_id)
          .eq("empresa_id", formData.empresa_id)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Registro duplicado",
            description: "Este agente já está atribuído a esta empresa.",
            variant: "destructive"
          });
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("agente_empresas")
          .insert({
            agente_id: formData.agente_id,
            empresa_id: formData.empresa_id,
            status: formData.status,
            observacoes: formData.observacoes || null,
            created_by: user?.id
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Agente atribuído com sucesso!" });
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o registro.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta atribuição?")) return;

    try {
      const { error } = await supabase
        .from("agente_empresas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Atribuição removida com sucesso!" });
      await fetchData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a atribuição.",
        variant: "destructive"
      });
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: StatusAgenteEmpresa) => {
    try {
      const { error } = await supabase
        .from("agente_empresas")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setData(prev => prev.map(item => 
        item.id === id ? { ...item, status: newStatus } : item
      ));
      
      toast({ title: "Status atualizado!" });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  };

  // Get empresas without certain agents
  const getEmpresasSemAgente = (agenteId: string) => {
    const empresasComAgente = new Set(
      data.filter(d => d.agente_id === agenteId).map(d => d.empresa_id)
    );
    return empresas.filter(e => !empresasComAgente.has(e.id));
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Controle de Agentes</h1>
              <p className="text-muted-foreground">
                Gerencie a atribuição e status de agentes por empresa
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Atribuir Agente
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.ativos}</p>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.emDesenvolvimento}</p>
                    <p className="text-xs text-muted-foreground">Em Dev</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Rocket className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.emRollout}</p>
                    <p className="text-xs text-muted-foreground">Roll Out</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inativos}</p>
                    <p className="text-xs text-muted-foreground">Inativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por agente, empresa ou cidade..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas Empresas</SelectItem>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedAgente} onValueChange={setSelectedAgente}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Bot className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Agente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Agentes</SelectItem>
                    {agentes.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas Marcas</SelectItem>
                    {filterOptions.marcas.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedUf} onValueChange={setSelectedUf}>
                  <SelectTrigger className="w-full md:w-[120px]">
                    <MapPin className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {filterOptions.ufs.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Atribuições de Agentes</CardTitle>
              <CardDescription>
                {filteredData.length} de {data.length} registros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Bot className="h-12 w-12 mb-4" />
                  <p>Nenhuma atribuição encontrada</p>
                  <Button variant="link" onClick={() => handleOpenModal()}>
                    Criar primeira atribuição
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agente</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>UF</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => {
                        const StatusIcon = statusConfig[item.status]?.icon || AlertCircle;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{item.agentes_ia?.nome || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.empresas?.nome_empresa || "—"}</p>
                                <p className="text-xs text-muted-foreground">{item.empresas?.cidade}</p>
                              </div>
                            </TableCell>
                            <TableCell>{item.empresas?.uf || "—"}</TableCell>
                            <TableCell>{item.empresas?.marca || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={item.status}
                                onValueChange={(value) => handleQuickStatusChange(item.id, value as StatusAgenteEmpresa)}
                              >
                                <SelectTrigger className="w-[160px] h-8">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="h-3 w-3" />
                                    <span className="text-xs">{statusConfig[item.status]?.label}</span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusConfig).map(([key, config]) => {
                                    const Icon = config.icon;
                                    return (
                                      <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-3 w-3" />
                                          <span>{config.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {item.observacoes || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenModal(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollIndicator>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Atribuição" : "Atribuir Agente"}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Altere o status ou observações da atribuição" 
                : "Vincule um agente a uma empresa"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agente *</Label>
              <Select
                value={formData.agente_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, agente_id: value }))}
                disabled={!!editingItem}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente" />
                </SelectTrigger>
                <SelectContent>
                  {agentes.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <span>{a.nome}</span>
                        {!a.ativo && <Badge variant="secondary" className="ml-2">Inativo</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select
                value={formData.empresa_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, empresa_id: value }))}
                disabled={!!editingItem}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {(editingItem ? empresas : (formData.agente_id ? getEmpresasSemAgente(formData.agente_id) : empresas)).map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{e.nome_empresa}</span>
                        <span className="text-muted-foreground text-xs">({e.uf})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as StatusAgenteEmpresa }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações sobre a atribuição..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingItem ? "Salvar" : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ControleAgentes;

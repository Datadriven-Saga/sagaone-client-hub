import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
  XCircle,
  Download,
  FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';

interface ControleAgente {
  id: string;
  nome_agente: string;
  tipo_agente: string;
  marca: string;
  uf: string;
  loja: string;
  cnpj: string;
  responsavel: string | null;
  implantador: string | null;
  telefone_toca: string | null;
  cronograma: string | null;
  status: string | null;
  chamado: string | null;
  observacoes: string | null;
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ok: { label: "OK", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  IMPLANTADA: { label: "Implantada", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  bloqueado: { label: "Bloqueado", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
  erro: { label: "Erro", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle },
  pendente: { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock },
};

const getStatusConfig = (status: string | null) => {
  if (!status) return { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock };
  return statusConfig[status] || { label: status, color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock };
};

const ControleAgentes = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<ControleAgente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgente, setSelectedAgente] = useState("todos");
  const [selectedTipo, setSelectedTipo] = useState("todos");
  const [selectedMarca, setSelectedMarca] = useState("todos");
  const [selectedUf, setSelectedUf] = useState("todos");
  const [selectedLoja, setSelectedLoja] = useState("todos");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [selectedResponsavel, setSelectedResponsavel] = useState("todos");
  const [selectedImplantador, setSelectedImplantador] = useState("todos");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ControleAgente | null>(null);
  const [formData, setFormData] = useState({
    nome_agente: "",
    tipo_agente: "",
    marca: "",
    uf: "",
    loja: "",
    cnpj: "",
    responsavel: "",
    implantador: "",
    telefone_toca: "",
    cronograma: "",
    status: "",
    chamado: "",
    observacoes: ""
  });
  const [saving, setSaving] = useState(false);

  // Filter options
  const filterOptions = useMemo(() => {
    const agentes = [...new Set(data.map(d => d.nome_agente))].sort();
    const tipos = [...new Set(data.map(d => d.tipo_agente))].sort();
    const marcas = [...new Set(data.map(d => d.marca))].sort();
    const ufs = [...new Set(data.map(d => d.uf))].sort();
    const lojas = [...new Set(data.map(d => d.loja))].sort();
    const statuses = [...new Set(data.map(d => d.status).filter(Boolean) as string[])].sort();
    const responsaveis = [...new Set(data.map(d => d.responsavel).filter(Boolean) as string[])].sort();
    const implantadores = [...new Set(data.map(d => d.implantador).filter(Boolean) as string[])].sort();
    return { agentes, tipos, marcas, ufs, lojas, statuses, responsaveis, implantadores };
  }, [data]);

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.nome_agente?.toLowerCase().includes(term) ||
          item.tipo_agente?.toLowerCase().includes(term) ||
          item.marca?.toLowerCase().includes(term) ||
          item.loja?.toLowerCase().includes(term) ||
          item.cnpj?.includes(term) ||
          item.responsavel?.toLowerCase().includes(term) ||
          item.implantador?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (selectedAgente !== "todos" && item.nome_agente !== selectedAgente) return false;
      if (selectedTipo !== "todos" && item.tipo_agente !== selectedTipo) return false;
      if (selectedMarca !== "todos" && item.marca !== selectedMarca) return false;
      if (selectedUf !== "todos" && item.uf !== selectedUf) return false;
      if (selectedLoja !== "todos" && item.loja !== selectedLoja) return false;
      if (selectedStatus !== "todos" && item.status !== selectedStatus) return false;
      if (selectedResponsavel !== "todos" && item.responsavel !== selectedResponsavel) return false;
      if (selectedImplantador !== "todos" && item.implantador !== selectedImplantador) return false;

      return true;
    });
  }, [data, searchTerm, selectedAgente, selectedTipo, selectedMarca, selectedUf, selectedLoja, selectedStatus, selectedResponsavel, selectedImplantador]);

  // Stats
  const stats = useMemo(() => ({
    total: data.length,
    ok: data.filter(d => d.status === 'ok' || d.status === 'IMPLANTADA').length,
    pendentes: data.filter(d => !d.status || d.status === 'pendente').length,
    erros: data.filter(d => d.status === 'erro' || d.status === 'bloqueado').length,
    comCronograma: data.filter(d => d.cronograma && d.status !== 'ok' && d.status !== 'IMPLANTADA').length,
  }), [data]);

  const hasActiveFilters = selectedAgente !== "todos" || selectedTipo !== "todos" ||
    selectedMarca !== "todos" || selectedUf !== "todos" || selectedLoja !== "todos" ||
    selectedStatus !== "todos" || selectedResponsavel !== "todos" ||
    selectedImplantador !== "todos" || searchTerm;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAgente("todos");
    setSelectedTipo("todos");
    setSelectedMarca("todos");
    setSelectedUf("todos");
    setSelectedLoja("todos");
    setSelectedStatus("todos");
    setSelectedResponsavel("todos");
    setSelectedImplantador("todos");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: controleData, error } = await supabase
        .from("controle_agentes")
        .select("*")
        .order("nome_agente")
        .order("tipo_agente")
        .order("marca");

      if (error) throw error;
      setData(controleData || []);
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

  const handleOpenModal = (item?: ControleAgente) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome_agente: item.nome_agente,
        tipo_agente: item.tipo_agente,
        marca: item.marca,
        uf: item.uf,
        loja: item.loja,
        cnpj: item.cnpj,
        responsavel: item.responsavel || "",
        implantador: item.implantador || "",
        telefone_toca: item.telefone_toca || "",
        cronograma: item.cronograma || "",
        status: item.status || "",
        chamado: item.chamado || "",
        observacoes: item.observacoes || ""
      });
    } else {
      setEditingItem(null);
      setFormData({
        nome_agente: "",
        tipo_agente: "",
        marca: "",
        uf: "",
        loja: "",
        cnpj: "",
        responsavel: "",
        implantador: "",
        telefone_toca: "",
        cronograma: "",
        status: "",
        chamado: "",
        observacoes: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome_agente || !formData.tipo_agente || !formData.marca || !formData.uf || !formData.loja || !formData.cnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("controle_agentes")
          .update({
            nome_agente: formData.nome_agente,
            tipo_agente: formData.tipo_agente,
            marca: formData.marca,
            uf: formData.uf,
            loja: formData.loja,
            cnpj: formData.cnpj,
            responsavel: formData.responsavel || null,
            implantador: formData.implantador || null,
            telefone_toca: formData.telefone_toca || null,
            cronograma: formData.cronograma || null,
            status: formData.status || null,
            chamado: formData.chamado || null,
            observacoes: formData.observacoes || null
          })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("controle_agentes")
          .insert({
            nome_agente: formData.nome_agente,
            tipo_agente: formData.tipo_agente,
            marca: formData.marca,
            uf: formData.uf,
            loja: formData.loja,
            cnpj: formData.cnpj,
            responsavel: formData.responsavel || null,
            implantador: formData.implantador || null,
            telefone_toca: formData.telefone_toca || null,
            cronograma: formData.cronograma || null,
            status: formData.status || null,
            chamado: formData.chamado || null,
            observacoes: formData.observacoes || null,
            created_by: user?.id
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Registro criado com sucesso!" });
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
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      const { error } = await supabase
        .from("controle_agentes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Registro removido com sucesso!" });
      await fetchData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o registro.",
        variant: "destructive"
      });
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("controle_agentes")
        .update({ status: newStatus || null })
        .eq("id", id);

      if (error) throw error;
      
      setData(prev => prev.map(item => 
        item.id === id ? { ...item, status: newStatus || null } : item
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

  // Export functions
  const exportData = (format: 'csv' | 'xlsx' | 'xls') => {
    const exportRows = filteredData.map(item => ({
      'Nome Agente': item.nome_agente,
      'Tipo': item.tipo_agente,
      'Marca': item.marca,
      'UF': item.uf,
      'Loja': item.loja,
      'CNPJ': item.cnpj,
      'Responsável': item.responsavel || '',
      'Implantador': item.implantador || '',
      'Telefone Toca': item.telefone_toca || '',
      'Cronograma': item.cronograma || '',
      'Status': item.status || '',
      'Chamado': item.chamado || '',
      'Observações': item.observacoes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle Agentes');

    const fileName = `controle-agentes-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: 'csv' });
    } else if (format === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: 'xlsx' });
    } else {
      XLSX.writeFile(wb, `${fileName}.xls`, { bookType: 'xls' });
    }

    toast({ title: "Exportação concluída!", description: `Arquivo ${format.toUpperCase()} gerado.` });
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
                Gerencie implantações e status de agentes por loja
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportData('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel (XLSX)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData('xls')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel 97-2003 (XLS)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Registro
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
                    <p className="text-2xl font-bold">{stats.ok}</p>
                    <p className="text-xs text-muted-foreground">Implantados</p>
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
                    <p className="text-2xl font-bold">{stats.comCronograma}</p>
                    <p className="text-xs text-muted-foreground">Em Roll Out</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-500/10">
                    <Clock className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pendentes}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
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
                    <p className="text-2xl font-bold">{stats.erros}</p>
                    <p className="text-xs text-muted-foreground">Erros/Bloq.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por agente, tipo, marca, loja, CNPJ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={selectedAgente} onValueChange={setSelectedAgente}>
                    <SelectTrigger className="w-full md:w-[160px]">
                      <Bot className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Agentes</SelectItem>
                      {filterOptions.agentes.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                    <SelectTrigger className="w-full md:w-[160px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Tipos</SelectItem>
                      {filterOptions.tipos.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                    <SelectTrigger className="w-full md:w-[140px]">
                      <SelectValue placeholder="Marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas Marcas</SelectItem>
                      {filterOptions.marcas.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <Select value={selectedUf} onValueChange={setSelectedUf}>
                    <SelectTrigger className="w-full md:w-[120px]">
                      <MapPin className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas UFs</SelectItem>
                      {filterOptions.ufs.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                    <SelectTrigger className="w-full md:w-[160px]">
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas Lojas</SelectItem>
                      {filterOptions.lojas.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full md:w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      {filterOptions.statuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
                    <SelectTrigger className="w-full md:w-[140px]">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Resp.</SelectItem>
                      {filterOptions.responsaveis.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedImplantador} onValueChange={setSelectedImplantador}>
                    <SelectTrigger className="w-full md:w-[140px]">
                      <SelectValue placeholder="Implantador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Impl.</SelectItem>
                      {filterOptions.implantadores.map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Exibindo {filteredData.length} de {data.length} registros
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Implantador</TableHead>
                      <TableHead>Cronograma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item) => {
                        const statusConf = getStatusConfig(item.status);
                        const StatusIcon = statusConf.icon;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nome_agente}</TableCell>
                            <TableCell>{item.tipo_agente}</TableCell>
                            <TableCell>{item.marca}</TableCell>
                            <TableCell>{item.uf}</TableCell>
                            <TableCell>{item.loja}</TableCell>
                            <TableCell className="text-xs font-mono">{item.cnpj}</TableCell>
                            <TableCell>{item.responsavel || '-'}</TableCell>
                            <TableCell>{item.implantador || '-'}</TableCell>
                            <TableCell>
                              {item.cronograma ? (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  {item.cronograma}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.status || "pendente"}
                                onValueChange={(value) => handleQuickStatusChange(item.id, value)}
                              >
                                <SelectTrigger className="h-8 w-[130px]">
                                  <div className="flex items-center gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    <span className="text-xs">{statusConf.label}</span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ok">OK</SelectItem>
                                  <SelectItem value="IMPLANTADA">Implantada</SelectItem>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="erro">Erro</SelectItem>
                                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenModal(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollIndicator>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Registro" : "Novo Registro"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do controle de agente
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome_agente">Nome do Agente *</Label>
              <Input
                id="nome_agente"
                value={formData.nome_agente}
                onChange={(e) => setFormData({ ...formData, nome_agente: e.target.value })}
                placeholder="Ex: Aila, Bela, Paty..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_agente">Tipo *</Label>
              <Input
                id="tipo_agente"
                value={formData.tipo_agente}
                onChange={(e) => setFormData({ ...formData, tipo_agente: e.target.value })}
                placeholder="Ex: Prosc. Acessorios, Entrega..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marca">Marca *</Label>
              <Input
                id="marca"
                value={formData.marca}
                onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                placeholder="Ex: Byd, Fiat, Toyota..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF *</Label>
              <Input
                id="uf"
                value={formData.uf}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                placeholder="Ex: DF, GO, MT..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loja">Loja *</Label>
              <Input
                id="loja"
                value={formData.loja}
                onChange={(e) => setFormData({ ...formData, loja: e.target.value })}
                placeholder="Ex: Park Sul, T-9..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="XX.XXX.XXX/XXXX-XX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="implantador">Implantador</Label>
              <Input
                id="implantador"
                value={formData.implantador}
                onChange={(e) => setFormData({ ...formData, implantador: e.target.value })}
                placeholder="Nome do implantador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone_toca">Telefone Toca</Label>
              <Input
                id="telefone_toca"
                value={formData.telefone_toca}
                onChange={(e) => setFormData({ ...formData, telefone_toca: e.target.value })}
                placeholder="Telefone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cronograma">Cronograma</Label>
              <Input
                id="cronograma"
                value={formData.cronograma}
                onChange={(e) => setFormData({ ...formData, cronograma: e.target.value })}
                placeholder="Ex: 12/fev, IMPLANTADA..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || "pendente"}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="IMPLANTADA">Implantada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chamado">Chamado</Label>
              <Input
                id="chamado"
                value={formData.chamado}
                onChange={(e) => setFormData({ ...formData, chamado: e.target.value })}
                placeholder="Número do chamado"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ControleAgentes;

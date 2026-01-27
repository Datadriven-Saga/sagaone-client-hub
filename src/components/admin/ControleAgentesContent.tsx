import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search,
  RefreshCw,
  X,
  Bot,
  Building2,
  MapPin,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Rocket,
  XCircle,
  Download,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  ChevronUp,
  Settings,
  Phone,
  Eye,
  Power,
  PowerOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';
import { ControleAgentesDetalhes } from "@/components/admin/ControleAgentesDetalhes";
import { ControleAgentesImport } from "@/components/admin/ControleAgentesImport";
import { ControleAgentesNovoModal } from "@/components/admin/ControleAgentesNovoModal";

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
  descricao: string | null;
  numero_telefone: string | null;
  ativo: boolean;
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ok: { label: "Implantado", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  IMPLANTADA: { label: "Implantado", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  em_desenvolvimento: { label: "Em Desenvolvimento", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Settings },
  em_roll_out: { label: "Em Roll Out", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Rocket },
  pendente: { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock },
  erro: { label: "Erro", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle },
  bloqueado: { label: "Bloqueado", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
};

const getStatusConfig = (status: string | null) => {
  if (!status) return { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock };
  return statusConfig[status] || { label: status, color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock };
};

const statusOptions = [
  { value: "ok", label: "Implantado" },
  { value: "IMPLANTADA", label: "Implantado" },
  { value: "em_desenvolvimento", label: "Em Desenvolvimento" },
  { value: "em_roll_out", label: "Em Roll Out" },
  { value: "pendente", label: "Pendente" },
  { value: "erro", label: "Erro" },
  { value: "bloqueado", label: "Bloqueado" },
];

const isActiveStatus = (status: string | null) => {
  return status === 'ok' || status === 'IMPLANTADA' || status === 'em_roll_out';
};

export function ControleAgentesContent() {
  const { toast } = useToast();
  const [data, setData] = useState<ControleAgente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgente, setSelectedAgente] = useState("todos");
  const [selectedMarca, setSelectedMarca] = useState("todos");
  const [selectedUf, setSelectedUf] = useState("todos");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [selectedAtivo, setSelectedAtivo] = useState("todos");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ControleAgente | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  const filterOptions = useMemo(() => {
    const agentes = [...new Set(data.map(d => d.nome_agente))].sort();
    const marcas = [...new Set(data.map(d => d.marca))].sort();
    const ufs = [...new Set(data.map(d => d.uf))].sort();
    return { agentes, marcas, ufs };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = item.nome_agente?.toLowerCase().includes(term) ||
          item.loja?.toLowerCase().includes(term) || item.cnpj?.includes(term);
        if (!matchesSearch) return false;
      }
      if (selectedAgente !== "todos" && item.nome_agente !== selectedAgente) return false;
      if (selectedMarca !== "todos" && item.marca !== selectedMarca) return false;
      if (selectedUf !== "todos" && item.uf !== selectedUf) return false;
      if (selectedStatus !== "todos" && item.status !== selectedStatus) return false;
      if (selectedAtivo === "ativo" && !item.ativo) return false;
      if (selectedAtivo === "inativo" && item.ativo) return false;
      return true;
    });
  }, [data, searchTerm, selectedAgente, selectedMarca, selectedUf, selectedStatus, selectedAtivo]);

  const stats = useMemo(() => ({
    total: data.length,
    implantados: data.filter(d => d.status === 'ok' || d.status === 'IMPLANTADA').length,
    emRollOut: data.filter(d => d.status === 'em_roll_out').length,
    pendentes: data.filter(d => !d.status || d.status === 'pendente').length,
    erros: data.filter(d => d.status === 'erro' || d.status === 'bloqueado').length,
  }), [data]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAgente("todos");
    setSelectedMarca("todos");
    setSelectedUf("todos");
    setSelectedStatus("todos");
    setSelectedAtivo("todos");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: controleData, error } = await supabase
        .from("controle_agentes")
        .select("*")
        .order("nome_agente");
      if (error) throw error;
      setData(controleData || []);
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível carregar os dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("controle_agentes").update({ status: newStatus || null }).eq("id", id);
      if (error) throw error;
      setData(prev => prev.map(item => item.id === id ? { ...item, status: newStatus || null } : item));
      toast({ title: "Status atualizado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase.from("controle_agentes").update({ ativo }).eq("id", id);
      if (error) throw error;
      setData(prev => prev.map(item => item.id === id ? { ...item, ativo } : item));
      toast({ title: ativo ? "Agente ativado!" : "Agente desativado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const exportData = (format: 'csv' | 'xlsx' | 'xls') => {
    const exportRows = filteredData.map(item => ({
      'Nome Agente': item.nome_agente, 'Tipo': item.tipo_agente, 'Marca': item.marca, 'UF': item.uf,
      'Loja': item.loja, 'CNPJ': item.cnpj, 'Status': item.status || '', 'Ativo': item.ativo ? 'Sim' : 'Não'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle Agentes');
    XLSX.writeFile(wb, `controle-agentes-${new Date().toISOString().split('T')[0]}.${format}`, { bookType: format === 'csv' ? 'csv' : format });
    toast({ title: "Exportação concluída!" });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={clearFilters}><CardContent className="p-3"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="text-xl font-bold">{stats.total}</p><p className="text-[10px] text-muted-foreground">Total</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><div><p className="text-xl font-bold">{stats.implantados}</p><p className="text-[10px] text-muted-foreground">Implantados</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-blue-500" /><div><p className="text-xl font-bold">{stats.emRollOut}</p><p className="text-[10px] text-muted-foreground">Em Roll Out</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /><div><p className="text-xl font-bold">{stats.pendentes}</p><p className="text-[10px] text-muted-foreground">Pendentes</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /><div><p className="text-xl font-bold">{stats.erros}</p><p className="text-[10px] text-muted-foreground">Erros</p></div></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Agente</Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => exportData('csv')}>CSV</DropdownMenuItem><DropdownMenuItem onClick={() => exportData('xlsx')}>Excel (XLSX)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
          <Select value={selectedAgente} onValueChange={setSelectedAgente}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Agente" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{filterOptions.agentes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedMarca} onValueChange={setSelectedMarca}><SelectTrigger className="w-[120px]"><SelectValue placeholder="Marca" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{filterOptions.marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedUf} onValueChange={setSelectedUf}><SelectTrigger className="w-[90px]"><SelectValue placeholder="UF" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{filterOptions.ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        </div>
      </CardContent></Card>

      <p className="text-sm text-muted-foreground">Exibindo {filteredData.length} de {data.length} agentes</p>

      <Card><CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-500px)] min-h-[300px]">
          <Table><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[50px]">Ativo</TableHead><TableHead>Agente</TableHead><TableHead>Local</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="w-[60px]">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              filteredData.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum agente encontrado</TableCell></TableRow> :
              filteredData.map(item => {
                const statusConf = getStatusConfig(item.status);
                const StatusIcon = statusConf.icon;
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedItem(item); setDetailsOpen(true); }}>
                    <TableCell><Badge variant={isActiveStatus(item.status) ? "default" : "secondary"} className={isActiveStatus(item.status) ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-gray-500/10 text-gray-600 border-gray-500/20"}>{isActiveStatus(item.status) ? "Sim" : "Não"}</Badge></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="font-medium">{item.nome_agente}</p><Badge variant="outline" className="font-normal text-xs">{item.tipo_agente}</Badge></div></div></TableCell>
                    <TableCell><span className="text-sm">{item.loja}</span><br/><span className="text-xs text-muted-foreground">{item.marca} • {item.uf}</span></TableCell>
                    <TableCell>{item.numero_telefone ? <span className="font-mono text-xs">{item.numero_telefone}</span> : '-'}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}><Select value={item.status || "pendente"} onValueChange={v => handleQuickStatusChange(item.id, v)}><SelectTrigger className="h-8 w-[120px]"><div className="flex items-center gap-1"><StatusIcon className="h-3 w-3" /><span className="text-xs">{statusConf.label}</span></div></SelectTrigger><SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent></Card>

      <ControleAgentesDetalhes agente={selectedItem} open={detailsOpen} onOpenChange={setDetailsOpen} onSave={fetchData} />
      <ControleAgentesImport open={importOpen} onOpenChange={setImportOpen} onImportComplete={fetchData} />
      <ControleAgentesNovoModal open={novoOpen} onOpenChange={setNovoOpen} onSave={fetchData} />
    </div>
  );
}

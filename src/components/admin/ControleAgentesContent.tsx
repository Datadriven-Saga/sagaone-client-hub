import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Search,
  RefreshCw,
  Bot,
  Plus,
  CheckCircle2,
  Clock,
  Rocket,
  XCircle,
  Download,
  Upload,
  Pencil,
  Eye,
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
  em_desenvolvimento: { label: "Em Desenvolvimento", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  em_roll_out: { label: "Em Roll Out", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Rocket },
  pendente: { label: "Pendente", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock },
  erro: { label: "Erro", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
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

const ITEMS_PER_PAGE = 20;

export function ControleAgentesContent() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<ControleAgente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgente, setSelectedAgente] = useState("todos");
  const [selectedMarca, setSelectedMarca] = useState("todos");
  const [selectedUf, setSelectedUf] = useState("todos");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [selectedAtivo, setSelectedAtivo] = useState("todos");
  const [selectedEstrategica, setSelectedEstrategica] = useState("todos");
  const [selectedItem, setSelectedItem] = useState<ControleAgente | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [strategicAgents, setStrategicAgents] = useState<Set<string>>(new Set());

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
      if (selectedEstrategica === "sim" && !strategicAgents.has(item.nome_agente)) return false;
      if (selectedEstrategica === "nao" && strategicAgents.has(item.nome_agente)) return false;
      return true;
    });
  }, [data, searchTerm, selectedAgente, selectedMarca, selectedUf, selectedStatus, selectedAtivo, selectedEstrategica, strategicAgents]);

  // Paginação
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedAgente, selectedMarca, selectedUf, selectedStatus, selectedAtivo, selectedEstrategica]);

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
    setSelectedEstrategica("todos");
    setCurrentPage(1);
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

  // Fetch strategic agents from agentes_visao
  useEffect(() => {
    const fetchStrategic = async () => {
      const { data: visaoData } = await supabase
        .from("agentes_visao")
        .select("nome, strategica")
        .eq("strategica", true);
      if (visaoData) {
        setStrategicAgents(new Set(visaoData.map(v => v.nome)));
      }
    };
    fetchStrategic();
  }, []);

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("controle_agentes").update({ status: newStatus || null }).eq("id", id);
      if (error) throw error;
      setData(prev => prev.map(item => item.id === id ? { ...item, status: newStatus || null } : item));
      toast({ title: "Status atualizado!" });
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

  // Gerar páginas para exibição
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={clearFilters}><CardContent className="p-3"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="text-xl font-bold">{stats.total.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Total</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><div><p className="text-xl font-bold">{stats.implantados.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Implantados</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-blue-500" /><div><p className="text-xl font-bold">{stats.emRollOut.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Em Roll Out</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /><div><p className="text-xl font-bold">{stats.pendentes.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Pendentes</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /><div><p className="text-xl font-bold">{stats.erros.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Erros</p></div></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Agente</Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/administracao/agentes/visao-geral')}><Eye className="h-4 w-4 mr-2" />Visão Geral</Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Exportar</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => exportData('csv')}>CSV</DropdownMenuItem><DropdownMenuItem onClick={() => exportData('xlsx')}>Excel (XLSX)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="flex-1 relative min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
          <Select value={selectedAgente} onValueChange={setSelectedAgente}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Agente" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{filterOptions.agentes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedMarca} onValueChange={setSelectedMarca}><SelectTrigger className="w-[120px]"><SelectValue placeholder="Marca" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{filterOptions.marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedUf} onValueChange={setSelectedUf}><SelectTrigger className="w-[90px]"><SelectValue placeholder="UF" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{filterOptions.ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedEstrategica} onValueChange={setSelectedEstrategica}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Estratégica" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem><SelectItem value="sim">Estratégica</SelectItem><SelectItem value="nao">Não Estratégica</SelectItem></SelectContent></Select>
        </div>
      </CardContent></Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length.toLocaleString('pt-BR')} agentes
        </p>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[50px]">Ativo</TableHead><TableHead>Agente</TableHead><TableHead>Estratégica</TableHead><TableHead>Local</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="w-[60px]">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              paginatedData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum agente encontrado</TableCell></TableRow> :
              paginatedData.map(item => {
                const statusConf = getStatusConfig(item.status);
                const StatusIcon = statusConf.icon;
                const isStrategic = strategicAgents.has(item.nome_agente);
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedItem(item); setDetailsOpen(true); }}>
                    <TableCell><Badge variant={isActiveStatus(item.status) ? "default" : "secondary"} className={isActiveStatus(item.status) ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-gray-500/10 text-gray-600 border-gray-500/20"}>{isActiveStatus(item.status) ? "Sim" : "Não"}</Badge></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="font-medium">{item.nome_agente}</p><Badge variant="outline" className="font-normal text-xs">{item.tipo_agente}</Badge></div></div></TableCell>
                    <TableCell><Badge variant={isStrategic ? "default" : "secondary"} className={isStrategic ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}>{isStrategic ? "Sim" : "Não"}</Badge></TableCell>
                    <TableCell><span className="text-sm">{item.loja}</span><br/><span className="text-xs text-muted-foreground">{item.marca} • {item.uf}</span></TableCell>
                    <TableCell>{item.numero_telefone ? <span className="font-mono text-xs">{item.numero_telefone}</span> : '-'}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}><Select value={item.status || "pendente"} onValueChange={v => handleQuickStatusChange(item.id, v)}><SelectTrigger className="h-8 w-[120px]"><div className="flex items-center gap-1"><StatusIcon className="h-3 w-3" /><span className="text-xs">{statusConf.label}</span></div></SelectTrigger><SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {getVisiblePages().map((page, idx) => (
              <PaginationItem key={idx}>
                {page === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ControleAgentesDetalhes agente={selectedItem} open={detailsOpen} onOpenChange={setDetailsOpen} onSave={fetchData} />
      <ControleAgentesImport open={importOpen} onOpenChange={setImportOpen} onImportComplete={fetchData} />
      <ControleAgentesNovoModal open={novoOpen} onOpenChange={setNovoOpen} onSave={fetchData} />
    </div>
  );
}

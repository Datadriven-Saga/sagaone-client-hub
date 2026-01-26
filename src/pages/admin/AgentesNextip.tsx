import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Download,
  Search,
  RefreshCw,
  Filter,
  X,
  Phone,
  Bot,
  Building2,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

interface AgenteNextip {
  id: string;
  codigo_id: string;
  nome: string;
  agente: string;
  marca: string;
  uf: string;
  loja: string;
  numero: string | null;
  status_meta: string | null;
  bu: string | null;
  id_numero: string | null;
  waba: string | null;
  id_aplicativo: string | null;
  instancia: string | null;
  created_at: string;
  updated_at: string;
}

interface FilterOptions {
  lojas: string[];
  marcas: string[];
  ufs: string[];
  agentes: string[];
  statuses: string[];
}

const AgentesNextip = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<AgenteNextip[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoja, setSelectedLoja] = useState("todos");
  const [selectedMarca, setSelectedMarca] = useState("todos");
  const [selectedUf, setSelectedUf] = useState("todos");
  const [selectedAgente, setSelectedAgente] = useState("todos");
  const [selectedStatus, setSelectedStatus] = useState("todos");

  // Filter options derived from data
  const filterOptions = useMemo<FilterOptions>(() => {
    const lojas = [...new Set(data.map(d => d.loja).filter(Boolean))].sort();
    const marcas = [...new Set(data.map(d => d.marca).filter(Boolean))].sort();
    const ufs = [...new Set(data.map(d => d.uf).filter(Boolean))].sort();
    const agentes = [...new Set(data.map(d => d.agente).filter(Boolean))].sort();
    const statuses = [...new Set(data.map(d => d.status_meta).filter(Boolean) as string[])].sort();
    return { lojas, marcas, ufs, agentes, statuses };
  }, [data]);

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.codigo_id?.toLowerCase().includes(term) ||
          item.nome?.toLowerCase().includes(term) ||
          item.numero?.toLowerCase().includes(term) ||
          item.loja?.toLowerCase().includes(term) ||
          item.marca?.toLowerCase().includes(term) ||
          item.instancia?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Dropdown filters
      if (selectedLoja !== "todos" && item.loja !== selectedLoja) return false;
      if (selectedMarca !== "todos" && item.marca !== selectedMarca) return false;
      if (selectedUf !== "todos" && item.uf !== selectedUf) return false;
      if (selectedAgente !== "todos" && item.agente !== selectedAgente) return false;
      if (selectedStatus !== "todos" && item.status_meta !== selectedStatus) return false;

      return true;
    });
  }, [data, searchTerm, selectedLoja, selectedMarca, selectedUf, selectedAgente, selectedStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: data.length,
    filtered: filteredData.length,
    conectados: data.filter(d => d.status_meta === "Conectado").length,
    lojas: filterOptions.lojas.length,
    marcas: filterOptions.marcas.length
  }), [data, filteredData, filterOptions]);

  const hasActiveFilters = selectedLoja !== "todos" || selectedMarca !== "todos" ||
    selectedUf !== "todos" || selectedAgente !== "todos" || selectedStatus !== "todos" || searchTerm;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLoja("todos");
    setSelectedMarca("todos");
    setSelectedUf("todos");
    setSelectedAgente("todos");
    setSelectedStatus("todos");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: agentes, error } = await supabase
        .from("agentes_nextip")
        .select("*")
        .order("codigo_id", { ascending: true });

      if (error) throw error;
      setData(agentes || []);
    } catch (error) {
      console.error("Erro ao buscar agentes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados dos agentes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV.",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 2) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar.",
          variant: "destructive"
        });
        return;
      }

      // Get headers and map to expected columns
      const headers = (jsonData[0] as string[]).map(h => String(h || "").trim().toLowerCase());
      const rows = jsonData.slice(1);

      // Map headers to column indices
      const columnMap: Record<string, number> = {
        id: headers.findIndex(h => h === "id"),
        nome: headers.findIndex(h => h === "nome"),
        agente: headers.findIndex(h => h === "agente"),
        marca: headers.findIndex(h => h === "marca"),
        uf: headers.findIndex(h => h === "uf"),
        loja: headers.findIndex(h => h === "loja"),
        numero: headers.findIndex(h => h === "numero"),
        status_meta: headers.findIndex(h => h === "status meta" || h === "status_meta"),
        bu: headers.findIndex(h => h === "bu"),
        id_numero: headers.findIndex(h => h === "id_numero"),
        waba: headers.findIndex(h => h === "waba"),
        id_aplicativo: headers.findIndex(h => h === "id_aplicativo"),
        instancia: headers.findIndex(h => h === "instancia" || h === "instância")
      };

      // Validate required columns
      const missingCols = [];
      if (columnMap.id === -1) missingCols.push("ID");
      if (columnMap.nome === -1) missingCols.push("Nome");
      if (columnMap.agente === -1) missingCols.push("Agente");
      if (columnMap.marca === -1) missingCols.push("Marca");
      if (columnMap.uf === -1) missingCols.push("UF");
      if (columnMap.loja === -1) missingCols.push("Loja");

      if (missingCols.length > 0) {
        toast({
          title: "Colunas obrigatórias ausentes",
          description: `As seguintes colunas são obrigatórias: ${missingCols.join(", ")}`,
          variant: "destructive"
        });
        return;
      }

      // Parse and prepare data for upsert
      const agentesToUpsert = rows
        .filter(row => {
          const rowArray = row as unknown[];
          return rowArray[columnMap.id] && String(rowArray[columnMap.id]).trim();
        })
        .map(row => {
          const rowArray = row as unknown[];
          const getValue = (col: number) => col !== -1 ? String(rowArray[col] || "").trim() : null;
          return {
            codigo_id: getValue(columnMap.id) || "",
            nome: getValue(columnMap.nome) || "",
            agente: getValue(columnMap.agente) || "",
            marca: getValue(columnMap.marca) || "",
            uf: getValue(columnMap.uf) || "",
            loja: getValue(columnMap.loja) || "",
            numero: getValue(columnMap.numero),
            status_meta: getValue(columnMap.status_meta),
            bu: getValue(columnMap.bu),
            id_numero: getValue(columnMap.id_numero),
            waba: getValue(columnMap.waba),
            id_aplicativo: getValue(columnMap.id_aplicativo),
            instancia: getValue(columnMap.instancia),
            created_by: user?.id
          };
        });

      if (agentesToUpsert.length === 0) {
        toast({
          title: "Nenhum dado válido",
          description: "Não foram encontrados registros válidos para importar.",
          variant: "destructive"
        });
        return;
      }

      // Upsert data - update on conflict
      const { error: upsertError } = await supabase
        .from("agentes_nextip")
        .upsert(agentesToUpsert, {
          onConflict: "codigo_id",
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      toast({
        title: "Importação concluída!",
        description: `${agentesToUpsert.length} agentes importados/atualizados com sucesso.`,
      });

      // Refresh data
      await fetchData();

    } catch (error) {
      console.error("Erro ao importar:", error);
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao processar o arquivo. Verifique o formato.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleExport = (format: "csv" | "xls" | "xlsx") => {
    const exportData = filteredData.map(item => ({
      "ID": item.codigo_id,
      "Nome": item.nome,
      "Agente": item.agente,
      "Marca": item.marca,
      "UF": item.uf,
      "Loja": item.loja,
      "Numero": item.numero,
      "Status Meta": item.status_meta,
      "BU": item.bu,
      "ID_NUMERO": item.id_numero,
      "WABA": item.waba,
      "ID_APLICATIVO": item.id_aplicativo,
      "Instância": item.instancia
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agentes Nextip");

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `agentes_nextip_${dateStr}`;

    if (format === "csv") {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
    } else if (format === "xls") {
      XLSX.writeFile(wb, `${filename}.xls`, { bookType: "xls" });
    } else {
      XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: "xlsx" });
    }

    toast({
      title: "Exportação concluída",
      description: `${exportData.length} registros exportados em ${format.toUpperCase()}.`
    });
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Agentes Nextip</h1>
              <p className="text-muted-foreground">
                Gerenciamento de números e instâncias de agentes Maia
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={filteredData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xls")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel 97-2003 (.xls)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <Button asChild variant="default" size="sm" disabled={importing}>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {importing ? "Importando..." : "Importar Excel"}
                  </span>
                </Button>
              </Label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
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
                    <p className="text-xs text-muted-foreground">Total Agentes</p>
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
                    <p className="text-2xl font-bold">{stats.conectados}</p>
                    <p className="text-xs text-muted-foreground">Conectados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.lojas}</p>
                    <p className="text-xs text-muted-foreground">Lojas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <FileSpreadsheet className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.marcas}</p>
                    <p className="text-xs text-muted-foreground">Marcas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Filter className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.filtered}</p>
                    <p className="text-xs text-muted-foreground">Filtrados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros</CardTitle>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                {/* Search */}
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por ID, nome, número, loja, marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* UF Filter */}
                <Select value={selectedUf} onValueChange={setSelectedUf}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todos">Todas UFs</SelectItem>
                    {filterOptions.ufs.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Loja Filter */}
                <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Loja" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todos">Todas Lojas</SelectItem>
                    {filterOptions.lojas.map(loja => (
                      <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Marca Filter */}
                <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todos">Todas Marcas</SelectItem>
                    {filterOptions.marcas.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Agente Filter */}
                <Select value={selectedAgente} onValueChange={setSelectedAgente}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Agente" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todos">Todos Agentes</SelectItem>
                    {filterOptions.agentes.map(agente => (
                      <SelectItem key={agente} value={agente}>{agente}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todos">Todos Status</SelectItem>
                    {filterOptions.statuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters Badges */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <Badge variant="secondary" className="gap-1">
                      Busca: {searchTerm}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm("")} />
                    </Badge>
                  )}
                  {selectedUf !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      UF: {selectedUf}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedUf("todos")} />
                    </Badge>
                  )}
                  {selectedLoja !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      Loja: {selectedLoja}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedLoja("todos")} />
                    </Badge>
                  )}
                  {selectedMarca !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      Marca: {selectedMarca}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedMarca("todos")} />
                    </Badge>
                  )}
                  {selectedAgente !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      Agente: {selectedAgente}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedAgente("todos")} />
                    </Badge>
                  )}
                  {selectedStatus !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      Status: {selectedStatus}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedStatus("todos")} />
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Lista de Agentes ({filteredData.length})
              </CardTitle>
              <CardDescription>
                Dados importados da planilha Nextip
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando...</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Nenhum agente encontrado</p>
                  <p className="text-sm">
                    {data.length === 0
                      ? "Importe um arquivo Excel para começar"
                      : "Tente ajustar os filtros"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">ID</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">Agente</TableHead>
                        <TableHead className="font-semibold">Marca</TableHead>
                        <TableHead className="font-semibold">UF</TableHead>
                        <TableHead className="font-semibold">Loja</TableHead>
                        <TableHead className="font-semibold">Número</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Instância</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs">{item.codigo_id}</TableCell>
                          <TableCell className="font-medium">{item.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.agente}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.marca}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {item.uf}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.loja}</TableCell>
                          <TableCell className="font-mono text-xs">{item.numero || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status_meta === "Conectado" ? "default" : "secondary"}
                              className={`text-xs ${item.status_meta === "Conectado" ? "bg-green-500/10 text-green-600 border-green-500/30" : ""}`}
                            >
                              {item.status_meta || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[150px] truncate" title={item.instancia || ""}>
                            {item.instancia || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Como importar dados:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Baixe a planilha do SharePoint</li>
                    <li>Clique em "Importar Excel" e selecione o arquivo</li>
                    <li>Os dados serão atualizados automaticamente (upsert por ID)</li>
                  </ol>
                  <p className="mt-2 text-xs">
                    Colunas obrigatórias: ID, Nome, Agente, Marca, UF, Loja
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default AgentesNextip;

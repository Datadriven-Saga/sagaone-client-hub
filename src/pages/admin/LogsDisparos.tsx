import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, DollarSign, Loader2, ChevronLeft, ChevronRight, Mail, Download, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogsNotificacoesEmailTab } from "@/components/admin/LogsNotificacoesEmailTab";
import { useDebounce } from "@/hooks/useDebounce";

interface LogDisparo {
  id: string;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_perfil: string | null;
  evento_nome: string;
  canal: string;
  total_contatos: number;
  total_sucesso: number | null;
  total_falha: number | null;
  cotacao_dolar: number | null;
  custo_total_usd: number;
  custo_total_brl: number | null;
  disparo_id: string;
  created_at: string;
  marca: string | null;
  uf: string | null;
  template_nome: string | null;
  origem: string;
  job_id: string | null;
}

const PAGE_SIZE = 20;

const getDefaultDates = () => {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    start: first.toISOString().split("T")[0],
    end: today.toISOString().split("T")[0],
  };
};

const LogsDisparos = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogDisparo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 400);
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [filtroEvento, setFiltroEvento] = useState("todos");
  const [filtroMarca, setFiltroMarca] = useState("todos");
  const [filtroUF, setFiltroUF] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const defaults = useMemo(() => getDefaultDates(), []);
  const [dataInicio, setDataInicio] = useState(defaults.start);
  const [dataFim, setDataFim] = useState(defaults.end);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totals, setTotals] = useState({ contatos: 0, usd: 0 });

  // Cotação para conversão sob demanda
  const [cotacao, setCotacao] = useState<number | null>(null);
  const [cotacaoLoading, setCotacaoLoading] = useState(false);
  const [mostrarBRL, setMostrarBRL] = useState(false);

  // Unique values for filters
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [eventos, setEventos] = useState<string[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);

  const buildQuery = (q: any) => {
    if (filtroUsuario !== "todos") q = q.eq("usuario_email", filtroUsuario);
    if (filtroEvento !== "todos") q = q.eq("evento_nome", filtroEvento);
    if (filtroMarca !== "todos") q = q.eq("marca", filtroMarca);
    if (filtroUF !== "todos") q = q.eq("uf", filtroUF);
    if (filtroOrigem !== "todos") q = q.eq("origem", filtroOrigem);
    if (dataInicio) q = q.gte("created_at", `${dataInicio}T00:00:00`);
    if (dataFim) q = q.lte("created_at", `${dataFim}T23:59:59`);
    if (debouncedSearch.trim()) {
      const t = debouncedSearch.trim();
      q = q.or(
        `usuario_nome.ilike.%${t}%,usuario_email.ilike.%${t}%,evento_nome.ilike.%${t}%,disparo_id.ilike.%${t}%,marca.ilike.%${t}%`,
      );
    }
    return q;
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("logs_disparos")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      query = buildQuery(query).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error("Erro ao buscar logs:", error);
        return;
      }

      setLogs((data as LogDisparo[]) || []);
      setTotalCount(count || 0);

      // Totalizadores do filtro atual (até 5000 linhas)
      let totalsQ = supabase
        .from("logs_disparos")
        .select("total_contatos, custo_total_usd")
        .limit(5000);
      totalsQ = buildQuery(totalsQ);
      const { data: allRows } = await totalsQ;
      const tContatos = (allRows || []).reduce((s, r: any) => s + (r.total_contatos || 0), 0);
      const tUsd = (allRows || []).reduce((s, r: any) => s + Number(r.custo_total_usd || 0), 0);
      setTotals({ contatos: tContatos, usd: tUsd });
    } finally {
      setLoading(false);
    }
  };

  // Fetch unique filter values via RPC (mais eficiente que select full-table)
  useEffect(() => {
    const fetchFilterValues = async () => {
      const { data, error } = await supabase.rpc("get_logs_disparos_filtros");
      if (error) {
        console.error("Erro ao buscar filtros:", error);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      setUsuarios(row?.usuarios || []);
      setEventos(row?.eventos || []);
      setMarcas(row?.marcas || []);
      setUfs(row?.ufs || []);
    };
    fetchFilterValues();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filtroUsuario, filtroEvento, filtroMarca, filtroUF, filtroOrigem, debouncedSearch, dataInicio, dataFim]);

  // Reset page quando filtros mudam
  useEffect(() => {
    setPage(0);
  }, [filtroUsuario, filtroEvento, filtroMarca, filtroUF, filtroOrigem, debouncedSearch, dataInicio, dataFim]);

  const fetchCotacao = async () => {
    setCotacaoLoading(true);
    try {
      const { data } = await supabase.functions.invoke("cotacao-dolar");
      if (data?.cotacao && typeof data.cotacao === "number") setCotacao(data.cotacao);
    } finally {
      setCotacaoLoading(false);
    }
  };

  // Buscar cotação automaticamente ao habilitar toggle BRL
  useEffect(() => {
    if (mostrarBRL && cotacao === null && !cotacaoLoading) fetchCotacao();
  }, [mostrarBRL]);

  const exportarCSV = async () => {
    let q = supabase
      .from("logs_disparos")
      .select("created_at,usuario_nome,usuario_email,usuario_perfil,evento_nome,canal,marca,uf,template_nome,origem,total_contatos,total_sucesso,total_falha,custo_total_usd,job_id")
      .order("created_at", { ascending: false })
      .limit(10000);
    q = buildQuery(q);
    const { data } = await q;
    const rows = data || [];
    const headers = ["Data/Hora","Usuário","Email","Perfil","Evento","Canal","Marca","UF","Template","Origem","Contatos","Sucesso","Falha","Custo USD","Custo BRL","Job ID"];
    const csvRows = rows.map((r: any) => {
      const usd = Number(r.custo_total_usd || 0);
      const brl = cotacao ? (usd * cotacao).toFixed(2) : "";
      return [
        new Date(r.created_at).toLocaleString("pt-BR"),
        r.usuario_nome || "",
        r.usuario_email || "",
        r.usuario_perfil || "",
        r.evento_nome || "",
        r.canal || "",
        r.marca || "",
        r.uf || "",
        r.template_nome || "",
        r.origem || "",
        r.total_contatos ?? "",
        r.total_sucesso ?? "",
        r.total_falha ?? "",
        usd.toFixed(4),
        brl,
        r.job_id || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = "\uFEFF" + headers.join(",") + "\n" + csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-disparos-${dataInicio}-a-${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const getCanalBadge = (canal: string) => {
    const c = String(canal).toLowerCase();
    if (c.includes('liga') || c === 'ligação') return <Badge className="bg-orange-100 text-orange-800">IA Ligação</Badge>;
    return <Badge className="bg-green-100 text-green-800">IA WhatsApp</Badge>;
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/administracao')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                Logs de Disparos
              </h1>
              <p className="text-sm text-muted-foreground">
                Registro de auditoria de todos os disparos e notificações
              </p>
            </div>
          </div>

          <Tabs defaultValue="disparos" className="w-full">
            <TabsList>
              <TabsTrigger value="disparos" className="gap-1.5">
                <DollarSign className="w-4 h-4" />
                Custos de Disparos
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-1.5">
                <Mail className="w-4 h-4" />
                Notificações Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="disparos" className="space-y-4 mt-4">
              {/* Filters */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email, evento, marca ou ID..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full md:w-[160px]"
                  />
                  <span className="text-muted-foreground text-sm self-center hidden md:block">até</span>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full md:w-[160px]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                    <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Usuário" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Usuários</SelectItem>
                      {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroEvento} onValueChange={setFiltroEvento}>
                    <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Evento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Eventos</SelectItem>
                      {eventos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                    <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Marca" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Marcas</SelectItem>
                      {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroUF} onValueChange={setFiltroUF}>
                    <SelectTrigger className="w-full md:w-[100px]"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                    <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Origens</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                      <SelectItem value="edge_function">Edge Function</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportarCSV} className="ml-auto">
                    <Download className="w-4 h-4 mr-1" /> CSV
                  </Button>
                </div>
              </Card>

              {/* Totalizadores + Toggle cotação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Contatos (filtro atual)</p>
                  <p className="text-2xl font-bold">{totals.contatos.toLocaleString("pt-BR")}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Custo Total USD</p>
                  <p className="text-2xl font-bold text-primary">{formatUSD(totals.usd)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Conversão BRL</p>
                    <Button
                      variant={mostrarBRL ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setMostrarBRL((v) => !v)}
                    >
                      {mostrarBRL ? "Ocultar" : "Mostrar BRL"}
                    </Button>
                  </div>
                  {mostrarBRL ? (
                    <>
                      <p className="text-2xl font-bold">
                        {cotacaoLoading || cotacao === null ? "..." : formatBRL(totals.usd * cotacao)}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                        <span>1 USD = {cotacao ? formatBRL(cotacao) : "—"}</span>
                        <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={fetchCotacao} disabled={cotacaoLoading}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${cotacaoLoading ? "animate-spin" : ""}`} />
                          Atualizar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Use a cotação atual para converter os valores em BRL.</p>
                  )}
                </Card>
              </div>

              {/* Table */}
              <Card className="overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum log de disparo encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Marca / UF</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Template</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Contatos</TableHead>
                          <TableHead className="text-right">Ok/Falha</TableHead>
                          <TableHead className="text-right">USD</TableHead>
                          {mostrarBRL && <TableHead className="text-right">BRL</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{log.usuario_nome || "—"}</p>
                                <p className="text-xs text-muted-foreground">{log.usuario_email || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{log.marca || "—"}</p>
                                <p className="text-xs text-muted-foreground">{log.uf || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm">{log.evento_nome}</TableCell>
                            <TableCell>{getCanalBadge(log.canal)}</TableCell>
                            <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{log.template_nome || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={log.origem === "edge_function" ? "default" : "secondary"} className="text-[10px]">
                                {log.origem === "edge_function" ? "Server" : "Cliente"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {log.total_contatos.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <span className="text-green-600">{log.total_sucesso ?? "—"}</span>
                              {" / "}
                              <span className="text-red-600">{log.total_falha ?? "—"}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatUSD(Number(log.custo_total_usd || 0))}
                            </TableCell>
                            {mostrarBRL && (
                              <TableCell className="text-right text-sm font-bold text-primary">
                                {cotacao ? formatBRL(Number(log.custo_total_usd || 0) * cotacao) : "—"}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">
                      {totalCount} registro{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm">
                        {page + 1} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <LogsNotificacoesEmailTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default LogsDisparos;

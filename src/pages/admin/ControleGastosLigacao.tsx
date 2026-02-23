import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPhone } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Search, Download, Phone, DollarSign, Clock, BarChart3, Loader2, Filter, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

interface CallRecord {
  id: string;
  phoneFrom: string;
  phoneTo: string;
  duration: number;
  cost: number;
  source: "twilio" | "vapi";
  date: string;
  status?: string;
}

const ITEMS_PER_PAGE = 20;

const ControleGastosLigacao = () => {
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [source, setSource] = useState<"twilio" | "vapi" | "unified">("unified");
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [serverSummary, setServerSummary] = useState<any>(null);
  const [fetched, setFetched] = useState(false);
  const [page, setPage] = useState(0);
  const [agentPhones, setAgentPhones] = useState<{ telefone: string; nome: string; display: string }[]>([]);
  // Table filters
  const [filterCallId, setFilterCallId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "error">("all");
  const [filterMinCost, setFilterMinCost] = useState("");
  const [filterMaxCost, setFilterMaxCost] = useState("");

  // Carregar telefones dos agentes Pri/Ligação
  useEffect(() => {
    const loadAgentPhones = async () => {
      const { data, error } = await supabase
        .from("agentes_ia")
        .select("telefone, nome")
        .ilike("nome", "%Ligação%")
        .not("telefone", "is", null);
      if (!error && data) {
        const seen = new Set<string>();
        const unique: { telefone: string; nome: string; display: string }[] = [];
        for (const a of data) {
          if (!a.telefone) continue;
          const digits = a.telefone.replace(/\D/g, "");
          if (digits.length < 10 || seen.has(digits)) continue;
          seen.add(digits);
          unique.push({ telefone: digits, nome: a.nome, display: formatPhone(a.telefone) || a.telefone });
        }
        setAgentPhones(unique);
      }
    };
    loadAgentPhones();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setPage(0);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-call-costs", {
        body: {
          phone: phone === "all" ? "" : phone,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          source,
        },
      });
      if (error) throw error;
      setCalls(data?.calls || []);
      setServerSummary(data?.summary || null);
      setFetched(true);
      // Show warnings from partial API failures
      if (data?.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }));
      }
      if (!data?.calls?.length && !data?.warnings?.length) toast.info("Nenhuma chamada encontrada no período");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao buscar dados: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // KPIs - use server summary when available (covers all records, not just displayed ones)
  const kpis = useMemo(() => {
    if (serverSummary) {
      return {
        totalCost: serverSummary.totalCost || 0,
        totalCalls: serverSummary.totalCalls || 0,
        totalDuration: serverSummary.totalDuration || 0,
        avgCost: serverSummary.totalCalls ? serverSummary.totalCost / serverSummary.totalCalls : 0,
        twilioCost: serverSummary.twilioCost || 0,
        vapiCost: serverSummary.vapiCost || 0,
      };
    }
    const totalCost = calls.reduce((s, c) => s + c.cost, 0);
    const totalDuration = calls.reduce((s, c) => s + c.duration, 0);
    const twilioCost = calls.filter(c => c.source === "twilio").reduce((s, c) => s + c.cost, 0);
    const vapiCost = calls.filter(c => c.source === "vapi").reduce((s, c) => s + c.cost, 0);
    return {
      totalCost,
      totalCalls: calls.length,
      totalDuration,
      avgCost: calls.length ? totalCost / calls.length : 0,
      twilioCost,
      vapiCost,
    };
  }, [calls, serverSummary]);

  // Chart data
  const costPerDay = useMemo(() => {
    const map: Record<string, { twilio: number; vapi: number }> = {};
    calls.forEach(c => {
      const day = c.date ? format(new Date(c.date), "yyyy-MM-dd") : "N/A";
      if (!map[day]) map[day] = { twilio: 0, vapi: 0 };
      map[day][c.source] += c.cost;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({
      day: format(new Date(day), "dd/MM"),
      twilio: +v.twilio.toFixed(4),
      vapi: +v.vapi.toFixed(4),
      total: +(v.twilio + v.vapi).toFixed(4),
    }));
  }, [calls]);

  const durationPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach(c => {
      const day = c.date ? format(new Date(c.date), "yyyy-MM-dd") : "N/A";
      map[day] = (map[day] || 0) + c.duration;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([day, dur]) => ({
      day: format(new Date(day), "dd/MM"),
      duracao: Math.round(dur / 60),
    }));
  }, [calls]);

  const pieData = useMemo(() => [
    { name: "Twilio", value: +kpis.twilioCost.toFixed(2) },
    { name: "Vapi", value: +kpis.vapiCost.toFixed(2) },
  ].filter(d => d.value > 0), [kpis]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

  // Filtered calls for table
  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      if (filterCallId && !c.id.toLowerCase().includes(filterCallId.toLowerCase())) return false;
      if (filterStatus === "error" && !c.status?.startsWith("erro")) return false;
      if (filterStatus === "success" && c.status?.startsWith("erro")) return false;
      const minC = parseFloat(filterMinCost);
      const maxC = parseFloat(filterMaxCost);
      if (!isNaN(minC) && c.cost < minC) return false;
      if (!isNaN(maxC) && c.cost > maxC) return false;
      return true;
    });
  }, [calls, filterCallId, filterStatus, filterMinCost, filterMaxCost]);

  // Pagination
  const paginatedCalls = filteredCalls.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCalls.length / ITEMS_PER_PAGE);

  // Export CSV
  const exportCSV = () => {
    if (!calls.length) return;
    const header = "Data,Origem,Telefone Origem,Telefone Destino,Duração (s),Custo (USD),ID";
    const rows = calls.map(c =>
      `${c.date},${c.source},${c.phoneFrom},${c.phoneTo},${c.duration},${c.cost.toFixed(4)},${c.id}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-ligacao-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtUSD = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Controle de Gastos — Ligação</h1>
            <p className="text-muted-foreground">Dashboard de custos e métricas de chamadas Twilio / Vapi</p>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Select value={phone} onValueChange={setPhone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os agentes</SelectItem>
                      {agentPhones.map((a, i) => (
                        <SelectItem key={i} value={a.telefone}>
                          {a.nome} — {a.display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Data inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label>Data final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label>Origem</Label>
                  <Select value={source} onValueChange={(v: any) => setSource(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unified">Unificado</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="vapi">Vapi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={fetchData} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar dados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
              ))}
            </div>
          )}

          {/* KPIs */}
          {fetched && !loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Custo Total (USD)", value: fmtUSD(kpis.totalCost), icon: DollarSign },
                { label: "Total Chamadas", value: kpis.totalCalls.toLocaleString("pt-BR"), icon: Phone },
                { label: "Duração Total", value: fmtDuration(kpis.totalDuration), icon: Clock },
                { label: "Ticket Médio (USD)", value: fmtUSD(kpis.avgCost), icon: BarChart3 },
                { label: "Custo Twilio (USD)", value: fmtUSD(kpis.twilioCost), icon: DollarSign },
                { label: "Custo Vapi (USD)", value: fmtUSD(kpis.vapiCost), icon: DollarSign },
              ].map(kpi => (
                <Card key={kpi.label}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <kpi.icon className="h-3.5 w-3.5" /> {kpi.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Charts */}
          {fetched && !loading && calls.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Line chart */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Custo por Dia</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={costPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: number) => fmtUSD(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie chart */}
              <Card>
                <CardHeader><CardTitle className="text-base">Divisão Twilio vs Vapi</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${fmtUSD(value)}`}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtUSD(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados</p>
                  )}
                </CardContent>
              </Card>

              {/* Bar chart */}
              <Card className="lg:col-span-3">
                <CardHeader><CardTitle className="text-base">Duração por Dia (min)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={durationPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="duracao" name="Duração (min)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Table */}
          {fetched && !loading && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Chamadas
                  <Badge variant="secondary" className="text-xs">{filteredCalls.length === calls.length ? calls.length.toLocaleString("pt-BR") : `${filteredCalls.length.toLocaleString("pt-BR")} de ${calls.length.toLocaleString("pt-BR")}`}</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={!calls.length} className="gap-1">
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Table Filters */}
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Filter className="h-3.5 w-3.5" /> Filtros:
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Call ID</Label>
                    <Input
                      placeholder="Buscar por ID..."
                      value={filterCallId}
                      onChange={e => { setFilterCallId(e.target.value); setPage(0); }}
                      className="h-8 w-44 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={filterStatus} onValueChange={(v: any) => { setFilterStatus(v); setPage(0); }}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="success">Sucesso</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo mín (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={filterMinCost}
                      onChange={e => { setFilterMinCost(e.target.value); setPage(0); }}
                      className="h-8 w-28 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo máx (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={filterMaxCost}
                      onChange={e => { setFilterMaxCost(e.target.value); setPage(0); }}
                      className="h-8 w-28 text-xs"
                    />
                  </div>
                  {(filterCallId || filterStatus !== "all" || filterMinCost || filterMaxCost) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => { setFilterCallId(""); setFilterStatus("all"); setFilterMinCost(""); setFilterMaxCost(""); setPage(0); }}
                    >
                      <X className="h-3.5 w-3.5" /> Limpar
                    </Button>
                  )}
                </div>

                {filteredCalls.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma chamada encontrada para os filtros selecionados.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Telefone Origem</TableHead>
                            <TableHead>Telefone Destino</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead>Custo</TableHead>
                            <TableHead>ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCalls.map(call => (
                            <TableRow key={call.id}>
                              <TableCell className="whitespace-nowrap">
                                {call.date ? format(new Date(call.date), "dd/MM/yy HH:mm") : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={call.source === "twilio" ? "default" : "secondary"}>
                                  {call.source === "twilio" ? "Twilio" : "Vapi"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={call.status?.startsWith("erro") ? "destructive" : "outline"} className="text-xs">
                                  {call.status?.startsWith("erro") ? "Erro" : (call.status || "OK")}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{call.phoneFrom || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{call.phoneTo || "—"}</TableCell>
                              <TableCell>{fmtDuration(call.duration)}</TableCell>
                              <TableCell className="font-mono">{fmtUSD(call.cost)}</TableCell>
                              <TableCell className="font-mono text-xs max-w-[120px] truncate" title={call.id}>{call.id}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleGastosLigacao;

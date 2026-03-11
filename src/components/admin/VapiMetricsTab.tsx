import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, BarChart3, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const ITEMS_PER_PAGE = 20;
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(var(--destructive))",
  "hsl(45, 80%, 55%)",
];

const fmtUSD = (v: number) => `US$ ${v.toFixed(2)}`;
const fmtDuration = (s: number) => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  return sec > 0 ? `${m}min ${sec}s` : `${m}min`;
};

const VapiMetricsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [assistantId, setAssistantId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [calls, setCalls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dailyChart, setDailyChart] = useState<any[]>([]);
  const [page, setPage] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setPage(0);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-vapi-metrics", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          assistantId: assistantId || undefined,
          phoneNumberId: phoneNumberId || undefined,
        },
      });
      if (error) throw error;
      setCalls(data?.calls || []);
      setSummary(data?.summary || null);
      setDailyChart(data?.dailyChart || []);
      setFetched(true);
      if (data?.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }));
      }
    } catch (e: any) {
      toast.error("Erro Vapi: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    if (!summary) return { totalCalls: 0, totalDuration: 0, avgCostPerMin: 0, totalCost: 0, successRate: 0 };
    const totalMin = summary.totalDuration / 60;
    return {
      totalCalls: summary.totalCalls,
      totalDuration: summary.totalDuration,
      avgCostPerMin: totalMin > 0 ? summary.totalCost / totalMin : 0,
      totalCost: summary.totalCost,
      successRate: summary.totalCalls > 0 ? (summary.endedCount / summary.totalCalls) * 100 : 0,
    };
  }, [summary]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    const cb = summary.costBreakdown;
    return [
      { name: "STT", value: +cb.stt.toFixed(4) },
      { name: "LLM", value: +cb.llm.toFixed(4) },
      { name: "TTS", value: +cb.tts.toFixed(4) },
      { name: "Transport", value: +cb.transport.toFixed(4) },
      { name: "Vapi", value: +cb.vapi.toFixed(4) },
    ].filter(d => d.value > 0);
  }, [summary]);

  const chartData = useMemo(() => {
    return dailyChart.map((d: any) => ({
      ...d,
      day: d.date?.length >= 10 ? format(new Date(d.date + "T00:00:00"), "dd/MM") : d.date,
    }));
  }, [dailyChart]);

  // Client-side filters
  const filteredCalls = useMemo(() => {
    return calls.filter((c: any) => {
      if (phoneSearch && !c.customer?.includes(phoneSearch)) return false;
      return true;
    });
  }, [calls, phoneSearch]);

  const paginatedCalls = filteredCalls.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCalls.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
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
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={fetchData} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar dados
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Assistant ID</Label>
              <Input placeholder="Filtrar por assistente" value={assistantId} onChange={e => setAssistantId(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number ID</Label>
              <Input placeholder="Filtrar por telefone Vapi" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Metadata Key</Label>
              <Input placeholder="Ex: campaignId" value={metadataKey} onChange={e => setMetadataKey(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Metadata Value</Label>
              <Input placeholder="Ex: abc123" value={metadataValue} onChange={e => setMetadataValue(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2"><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      )}

      {/* KPI Cards - Funnel order: Volume → Duration → AvgCost/Min → Total Cost → Success Rate */}
      {fetched && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Volume de Chamadas", value: kpis.totalCalls.toLocaleString("pt-BR"), icon: Phone },
            { label: "Duração Total", value: fmtDuration(kpis.totalDuration), icon: Clock },
            { label: "Custo Médio/Min", value: fmtUSD(kpis.avgCostPerMin), icon: BarChart3 },
            { label: "Custo Total (USD)", value: fmtUSD(kpis.totalCost), icon: DollarSign },
            { label: "Taxa de Sucesso", value: `${kpis.successRate.toFixed(1)}%`, icon: Activity },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <kpi.icon className="h-3.5 w-3.5 shrink-0" /> {kpi.label}
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
      {fetched && !loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Evolução Diária de Custos</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    formatter={(v: number) => [fmtUSD(v), "Custo"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="cost" name="Custo (USD)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Composição de Custos</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, value }) => `${name}: ${fmtUSD(value)}`}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtUSD(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados de composição</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Table */}
      {fetched && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              Auditoria Detalhada
              <Badge variant="secondary" className="text-xs">{filteredCalls.length} chamadas</Badge>
            </CardTitle>
            <div className="flex-shrink-0">
              <Input
                placeholder="Buscar cliente..."
                value={phoneSearch}
                onChange={e => { setPhoneSearch(e.target.value); setPage(0); }}
                className="h-8 w-48 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredCalls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma chamada encontrada.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nº Agente</TableHead>
                        <TableHead>Nº Cliente</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCalls.map((call: any) => (
                        <TableRow key={call.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {call.date ? format(new Date(call.date), "dd/MM/yy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{call.id?.substring(0, 12) || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{call.customer || "—"}</TableCell>
                          <TableCell>{fmtDuration(call.duration)}</TableCell>
                          <TableCell>
                            <Badge variant={call.status === "ended" ? "outline" : "destructive"} className="text-xs">
                              {call.status === "ended" ? "Sucesso" : call.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{fmtUSD(call.cost)}</TableCell>
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
  );
};

export default VapiMetricsTab;

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
import { CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, BarChart3, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface VapiCall {
  id: string;
  customer: string;
  duration: number;
  cost: number;
  status: string;
  date: string;
  costBreakdown: { stt: number; llm: number; tts: number; transport: number; vapi: number };
}

interface VapiSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  endedCount: number;
  costBreakdown: { stt: number; llm: number; tts: number; transport: number; vapi: number };
  isPartial: boolean;
}

const ITEMS_PER_PAGE = 20;
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(210, 70%, 55%)",
  "hsl(160, 60%, 45%)",
];

const fmtUSD = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

const fmtDuration = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}min ${sec}s`;
};

const VapiMetricsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [assistantId, setAssistantId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [summary, setSummary] = useState<VapiSummary | null>(null);
  const [dailyChart, setDailyChart] = useState<{ date: string; cost: number; count: number }[]>([]);
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
      if (!data?.calls?.length && !data?.warnings?.length) toast.info("Nenhuma chamada encontrada no período");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao buscar métricas Vapi: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    if (!summary) return { totalCost: 0, totalCalls: 0, totalDuration: 0, avgCostPerMin: 0, successRate: 0 };
    const totalMinutes = summary.totalDuration / 60;
    return {
      totalCost: summary.totalCost,
      totalCalls: summary.totalCalls,
      totalDuration: summary.totalDuration,
      avgCostPerMin: totalMinutes > 0 ? summary.totalCost / totalMinutes : 0,
      successRate: summary.totalCalls > 0 ? (summary.endedCount / summary.totalCalls) * 100 : 0,
    };
  }, [summary]);

  // Pie data for cost composition
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

  // Daily chart formatted
  const chartData = useMemo(() => {
    return dailyChart.map(d => ({
      ...d,
      day: d.date.length >= 10 ? format(new Date(d.date + "T00:00:00"), "dd/MM") : d.date,
    }));
  }, [dailyChart]);

  // Pagination
  const paginatedCalls = calls.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(calls.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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

            <div className="space-y-1.5">
              <Label>Assistant ID</Label>
              <Input
                placeholder="ID do assistente (opcional)"
                value={assistantId}
                onChange={e => setAssistantId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phone Number ID</Label>
              <Input
                placeholder="ID do telefone (opcional)"
                value={phoneNumberId}
                onChange={e => setPhoneNumberId(e.target.value)}
              />
            </div>

            <Button onClick={fetchData} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2"><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          </div>
        </>
      )}

      {/* KPI Cards */}
      {fetched && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Custo Total (USD)", value: fmtUSD(kpis.totalCost), icon: DollarSign },
            { label: "Volume de Chamadas", value: kpis.totalCalls.toLocaleString("pt-BR"), icon: Phone },
            { label: "Custo Médio/Min (USD)", value: fmtUSD(kpis.avgCostPerMin), icon: BarChart3 },
            { label: "Duração Total", value: fmtDuration(kpis.totalDuration), icon: Clock },
            { label: "Taxa de Sucesso", value: `${kpis.successRate.toFixed(1)}%`, icon: Activity },
          ].map(kpi => (
            <Card key={kpi.label} className="overflow-hidden">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 truncate">
                  <kpi.icon className="h-3 w-3 shrink-0" /> <span className="truncate">{kpi.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-lg font-bold truncate">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {fetched && !loading && calls.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily cost line chart */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Evolução Diária de Custos</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmtUSD(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="cost" name="Custo (USD)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost composition pie chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Composição de Custos</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${fmtUSD(value)}`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Tabela de Auditoria
              <Badge variant="secondary" className="text-xs">{calls.length.toLocaleString("pt-BR")} chamadas</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calls.length === 0 ? (
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
                        <TableHead>ID da Chamada</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Custo (USD)</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCalls.map(call => (
                        <TableRow key={call.id}>
                          <TableCell className="font-mono text-xs max-w-[140px] truncate" title={call.id}>
                            {call.id}
                          </TableCell>
                          <TableCell className="text-sm">{call.customer}</TableCell>
                          <TableCell>{fmtDuration(call.duration)}</TableCell>
                          <TableCell>
                            <Badge variant={call.status === "ended" ? "outline" : "destructive"} className="text-xs">
                              {call.status === "ended" ? "Sucesso" : call.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{fmtUSD(call.cost)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {call.date ? format(new Date(call.date), "dd/MM/yy HH:mm") : "—"}
                          </TableCell>
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

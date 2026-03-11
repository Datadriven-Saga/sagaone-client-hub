import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPhone } from "@/lib/utils";
import { format, subDays, addDays, differenceInDays, min as minDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, BarChart3, Activity, AlertTriangle, Eye, ChevronDown, ChevronsUpDown, Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell
} from "recharts";
import CallDetailModal from "./CallDetailModal";

const ITEMS_PER_PAGE = 20;
const BATCH_DAYS = 14;
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
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
};

interface VapiResource {
  id: string;
  name: string;
  number?: string;
}

// ── Multi-select dropdown component ──
const MultiSelectDropdown = ({
  label,
  items,
  selected,
  onSelectionChange,
  loading,
  formatItem,
}: {
  label: string;
  items: VapiResource[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  loading: boolean;
  formatItem: (item: VapiResource) => string;
}) => {
  const allSelected = items.length > 0 && selected.length === items.length;
  const noneSelected = selected.length === 0;
  const [open, setOpen] = useState(false);

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
      return;
    }
    onSelectionChange(items.map(i => i.id));
  };

  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      onSelectionChange(selected.filter(s => s !== id));
      return;
    }
    onSelectionChange([...selected, id]);
  };

  const displayText = () => {
    if (loading) return "Carregando...";
    if (noneSelected) return `Nenhum (0)`;
    if (allSelected) return `Todos (${items.length})`;
    if (selected.length === 1) {
      const item = items.find(i => i.id === selected[0]);
      return item ? formatItem(item) : selected[0].substring(0, 12);
    }
    return `${selected.length} selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{displayText()}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="overflow-y-auto max-h-[300px] p-2 space-y-0.5">
          {/* Select All */}
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            <span className="font-medium">Selecionar todos</span>
            <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
          </label>
          <div className="h-px bg-border my-1" />
          {items.map(item => (
            <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => toggleItem(item.id)}
              />
              <span className="truncate">{formatItem(item)}</span>
            </label>
          ))}
          {items.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum item encontrado</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── Batch fetching helpers ──
function computeBatches(start: Date, end: Date): { startDate: string; endDate: string }[] {
  const batches: { startDate: string; endDate: string }[] = [];
  let current = new Date(start);
  while (current <= end) {
    const batchEnd = minDate([addDays(current, BATCH_DAYS - 1), end]);
    batches.push({
      startDate: format(current, "yyyy-MM-dd"),
      endDate: format(batchEnd, "yyyy-MM-dd"),
    });
    current = addDays(batchEnd, 1);
  }
  return batches;
}

function mergeSummaries(results: any[]): any {
  const merged = {
    totalCalls: 0, totalCost: 0, totalDuration: 0, endedCount: 0,
    costBreakdown: { stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 },
    isPartial: false,
  };
  for (const r of results) {
    if (!r?.summary) continue;
    const s = r.summary;
    merged.totalCalls += s.totalCalls || 0;
    merged.totalCost += s.totalCost || 0;
    merged.totalDuration += s.totalDuration || 0;
    merged.endedCount += s.endedCount || 0;
    if (s.isPartial) merged.isPartial = true;
    if (s.costBreakdown) {
      merged.costBreakdown.stt += s.costBreakdown.stt || 0;
      merged.costBreakdown.llm += s.costBreakdown.llm || 0;
      merged.costBreakdown.tts += s.costBreakdown.tts || 0;
      merged.costBreakdown.transport += s.costBreakdown.transport || 0;
      merged.costBreakdown.vapi += s.costBreakdown.vapi || 0;
    }
  }
  return merged;
}

function mergeDailyCharts(results: any[]): any[] {
  const map: Record<string, { cost: number; count: number }> = {};
  for (const r of results) {
    for (const d of (r?.dailyChart || [])) {
      if (!map[d.date]) map[d.date] = { cost: 0, count: 0 };
      map[d.date].cost += d.cost || 0;
      map[d.date].count += d.count || 0;
    }
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, cost: +v.cost.toFixed(4), count: v.count }));
}

function mergeCalls(results: any[]): any[] {
  const all: any[] = [];
  for (const r of results) {
    all.push(...(r?.calls || []));
  }
  // Deduplicate by id
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const c of all) {
    if (c.id && seen.has(c.id)) continue;
    if (c.id) seen.add(c.id);
    unique.push(c);
  }
  return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ── Main Component ──
const VapiMetricsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [calls, setCalls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dailyChart, setDailyChart] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [dateWarning, setDateWarning] = useState("");
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [batchProgress, setBatchProgress] = useState({ total: 0, completed: 0, days: 0 });

  // Dynamic dropdown data
  const [vapiAssistants, setVapiAssistants] = useState<VapiResource[]>([]);
  const [vapiPhones, setVapiPhones] = useState<VapiResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    const loadVapiResources = async () => {
      setLoadingResources(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-vapi-metrics", {
          body: { action: "list-resources" },
        });
        if (!error && data) {
          setVapiAssistants((data.assistants || []).map((a: any) => ({ id: a.id, name: a.name, number: undefined })));
          setVapiPhones((data.phoneNumbers || []).map((p: any) => ({ id: p.id, name: p.name || "", number: p.number })));
        }
      } catch {
        // silent fail
      } finally {
        setLoadingResources(false);
      }
    };
    loadVapiResources();
  }, []);

  // Inicializa filtros com todos os itens quando os recursos carregam
  useEffect(() => {
    if (vapiAssistants.length > 0 && selectedAssistants.length === 0) {
      setSelectedAssistants(vapiAssistants.map((a) => a.id));
    }
  }, [vapiAssistants]);

  useEffect(() => {
    if (vapiPhones.length > 0 && selectedPhones.length === 0) {
      setSelectedPhones(vapiPhones.map((p) => p.id));
    }
  }, [vapiPhones]);

  const fetchData = async () => {
    setLoading(true);
    setPage(0);
    setDateWarning("");

    const totalDays = differenceInDays(endDate, startDate) + 1;
    const batches = computeBatches(startDate, endDate);
    const totalBatches = batches.length;

    setBatchProgress({ total: totalBatches, completed: 0, days: totalDays });

    // For each batch, we may need to query per-assistant and per-phone
    // But the edge function handles single assistantId/phoneNumberId
    // We'll send one request per batch, passing arrays
    const allResults: any[] = [];
    const allWarnings: string[] = [];
    let retentionLimitHit = false;

    try {
      // Run batches in parallel (max 3 concurrent to avoid overload)
      const CONCURRENCY = 3;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        if (retentionLimitHit) break;

        const chunk = batches.slice(i, i + CONCURRENCY);
        const promises = chunk.map(async (batch) => {
          try {
            const { data, error } = await supabase.functions.invoke("fetch-vapi-metrics", {
              body: {
                startDate: batch.startDate,
                endDate: batch.endDate,
                assistantIds: selectedAssistants,
                phoneNumberIds: selectedPhones,
              },
            });
            if (error) throw error;

            // Check for retention limit
            const warnings: string[] = data?.warnings || [];
            for (const w of warnings) {
              if (w.toLowerCase().includes("subscription") || w.toLowerCase().includes("plan limit") || w.toLowerCase().includes("retenção")) {
                retentionLimitHit = true;
                setDateWarning("Dados limitados aos últimos 14 dias pelo seu plano Vapi.");
              }
            }
            allWarnings.push(...warnings);
            return data;
          } catch (e: any) {
            if (e.message?.includes("subscription") || e.message?.includes("plan limit")) {
              retentionLimitHit = true;
              setDateWarning("Dados limitados aos últimos 14 dias pelo seu plano Vapi.");
            }
            allWarnings.push(`Lote ${batch.startDate}: ${e.message}`);
            return null;
          }
        });

        const results = await Promise.all(promises);
        allResults.push(...results.filter(Boolean));
        setBatchProgress(prev => ({ ...prev, completed: Math.min(i + CONCURRENCY, batches.length) }));
      }

      // Merge all results
      const mergedSummary = mergeSummaries(allResults);
      const mergedChart = mergeDailyCharts(allResults);
      const mergedCalls = mergeCalls(allResults);

      setSummary(mergedSummary);
      setDailyChart(mergedChart);
      setCalls(mergedCalls);
      setFetched(true);

      // Show unique warnings
      const uniqueWarnings = [...new Set(allWarnings)];
      uniqueWarnings.forEach(w => toast.warning(w, { duration: 8000 }));
    } catch (e: any) {
      toast.error("Erro Vapi: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
      setBatchProgress({ total: 0, completed: 0, days: 0 });
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
    if (!summary?.costBreakdown) return [];
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

  const filteredCalls = useMemo(() => {
    return calls.filter((c: any) => {
      if (phoneSearch && !c.customer?.includes(phoneSearch) && !c.agentPhone?.includes(phoneSearch)) return false;
      return true;
    });
  }, [calls, phoneSearch]);

  const paginatedCalls = filteredCalls.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCalls.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {dateWarning && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm text-yellow-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
          <span>{dateWarning}</span>
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Assistentes</Label>
              <MultiSelectDropdown
                label="Assistentes"
                items={vapiAssistants}
                selected={selectedAssistants}
                onSelectionChange={setSelectedAssistants}
                loading={loadingResources}
                formatItem={(item) => item.name || item.id.substring(0, 12)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Números Vapi</Label>
              <MultiSelectDropdown
                label="Números"
                items={vapiPhones}
                selected={selectedPhones}
                onSelectionChange={setSelectedPhones}
                loading={loadingResources}
                formatItem={(item) => {
                  const formatted = formatPhone(item.number) || item.number || item.id.substring(0, 12);
                  return item.name ? `${item.name} — ${formatted}` : formatted;
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch progress indicator */}
      {loading && batchProgress.total > 1 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
          <span>
            Consultando histórico: Processando {batchProgress.completed}/{batchProgress.total} requisições para cobrir {batchProgress.days} dias de dados...
          </span>
        </div>
      )}

      {/* Loading skeletons */}
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

      {/* KPI Cards */}
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
                placeholder="Buscar telefone..."
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
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCalls.map((call: any) => (
                        <TableRow key={call.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {call.date ? format(new Date(call.date), "dd/MM/yy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatPhone(call.agentPhone) || call.agentPhone || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{formatPhone(call.customer) || call.customer || "—"}</TableCell>
                          <TableCell>{fmtDuration(call.duration)}</TableCell>
                          <TableCell>
                            <Badge variant={call.status === "ended" ? "outline" : "destructive"} className="text-xs">
                              {call.status === "ended" ? "Sucesso" : call.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{fmtUSD(call.cost)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCall(call)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
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

      <CallDetailModal open={!!selectedCall} onOpenChange={() => setSelectedCall(null)} call={selectedCall} source="vapi" />
    </div>
  );
};

export default VapiMetricsTab;

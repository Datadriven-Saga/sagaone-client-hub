import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPhone } from "@/lib/utils";
import { format, subDays, addDays, differenceInDays, min as minDate, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, BarChart3, Activity,
  AlertTriangle, ChevronsUpDown, Database, TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";


const BATCH_DAYS = 14;

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
  const map: Record<string, { cost: number; count: number; duration: number; stt: number; llm: number; tts: number; transport: number; vapi: number }> = {};
  for (const r of results) {
    for (const d of (r?.dailyChart || [])) {
      if (!map[d.date]) map[d.date] = { cost: 0, count: 0, duration: 0, stt: 0, llm: 0, tts: 0, transport: 0, vapi: 0 };
      const b = map[d.date];
      b.cost += d.cost || 0;
      b.count += d.count || 0;
      b.duration += d.duration || 0;
      b.stt += d.stt || 0;
      b.llm += d.llm || 0;
      b.tts += d.tts || 0;
      b.transport += d.transport || 0;
      b.vapi += d.vapi || 0;
    }
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      cost: +v.cost.toFixed(4),
      count: v.count,
      duration: v.duration,
      stt: +v.stt.toFixed(4),
      llm: +v.llm.toFixed(4),
      tts: +v.tts.toFixed(4),
      transport: +v.transport.toFixed(4),
      vapi: +v.vapi.toFixed(4),
    }));
}


// ── Main Component ──
const VapiMetricsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [dailyChart, setDailyChart] = useState<any[]>([]);
  const [dateWarning, setDateWarning] = useState("");
  const [batchProgress, setBatchProgress] = useState({ total: 0, completed: 0, days: 0 });
  const [dataSource, setDataSource] = useState<string>("");

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

  const invokeWithRetry = async (body: any) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.functions.invoke("fetch-vapi-metrics", { body });
      if (!error) return data;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 800));
    }
    // Final fallback: direct fetch
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-vapi-metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const fetchData = async () => {
    setLoading(true);
    setDateWarning("");

    const totalDays = differenceInDays(endDate, startDate) + 1;
    const batches = computeBatches(startDate, endDate);
    const totalBatches = batches.length;

    setBatchProgress({ total: totalBatches, completed: 0, days: totalDays });

    const allResults: any[] = [];
    const allWarnings: string[] = [];
    let retentionLimitHit = false;

    try {
      const CONCURRENCY = 3;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        if (retentionLimitHit) break;

        const chunk = batches.slice(i, i + CONCURRENCY);
        const promises = chunk.map(async (batch) => {
          try {
            const data = await invokeWithRetry({
                startDate: batch.startDate,
                endDate: batch.endDate,
                assistantIds: selectedAssistants,
                phoneNumberIds: selectedPhones,
                ...(metadataKey.trim() ? { metadataKey: metadataKey.trim(), metadataValue: metadataValue.trim() } : {}),
            });

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

      setSummary(mergeSummaries(allResults));
      setDailyChart(mergeDailyCharts(allResults));
      setFetched(true);

      const sources = allResults.map(r => r?.source).filter(Boolean);
      if (sources.includes("cache+vapi")) {
        setDataSource("cache+vapi");
      } else {
        setDataSource("vapi");
      }

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

  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");

  const chartData = useMemo(() => {
    // First format the raw daily data
    const daily = dailyChart.map((d: any) => {
      let day = d.date || "";
      try {
        if (day.length >= 10) {
          const parsed = new Date(day + "T00:00:00");
          if (!isNaN(parsed.getTime())) {
            day = format(parsed, "dd/MM");
          }
        }
      } catch { /* keep raw */ }
      return { ...d, day };
    });

    if (granularity === "daily") return daily;

    // Aggregate by week or month
    const buckets: Record<string, { llm: number; vapi: number; transport: number; cost: number; count: number; duration: number }> = {};
    for (const d of dailyChart) {
      let key = d.date || "";
      try {
        const parsed = new Date(d.date + "T00:00:00");
        if (!isNaN(parsed.getTime())) {
          if (granularity === "weekly") {
            const ws = startOfWeek(parsed, { weekStartsOn: 1 });
            key = format(ws, "dd/MM");
          } else {
            const ms = startOfMonth(parsed);
            key = format(ms, "MMM/yy", { locale: ptBR });
          }
        }
      } catch { /* keep raw */ }
      if (!buckets[key]) buckets[key] = { llm: 0, vapi: 0, transport: 0, cost: 0, count: 0, duration: 0 };
      const b = buckets[key];
      b.llm += d.llm || 0;
      b.vapi += d.vapi || 0;
      b.transport += d.transport || 0;
      b.cost += d.cost || 0;
      b.count += d.count || 0;
      b.duration += d.duration || 0;
    }
    return Object.entries(buckets).map(([day, v]) => ({ day, ...v }));
  }, [dailyChart, granularity]);

  return (
    <div className="space-y-5 pt-2">
      {/* Data source indicator */}
      {fetched && !loading && dataSource === "cache+vapi" && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-sm">
          <Database className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">Histórico completo via Banco de Dados — dados além de 14 dias recuperados do cache local.</span>
        </div>
      )}

      {/* Warnings */}
      {dateWarning && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <span className="text-muted-foreground">{dateWarning}</span>
        </div>
      )}

      {/* Filters */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background/50 border-border/60">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background/50 border-border/60">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={fetchData} disabled={loading} className="gap-2 h-10">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar dados
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Assistentes</Label>
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
              <Label className="text-xs font-medium text-muted-foreground">Números Vapi</Label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Metadata — Chave</Label>
              <Input
                placeholder="Ex: dealerId, campaignId..."
                value={metadataKey}
                onChange={e => setMetadataKey(e.target.value)}
                className="h-9 text-sm bg-background/50 border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Metadata — Valor</Label>
              <Input
                placeholder="Ex: 12345"
                value={metadataValue}
                onChange={e => setMetadataValue(e.target.value)}
                className="h-9 text-sm bg-background/50 border-border/60"
                disabled={!metadataKey.trim()}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch progress indicator */}
      {loading && batchProgress.total > 1 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
          <span className="text-muted-foreground">
            Consultando histórico: Processando {batchProgress.completed}/{batchProgress.total} requisições para cobrir {batchProgress.days} dias de dados...
          </span>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="border-border/50">
                <CardContent className="pt-5 pb-4 px-5">
                  <Skeleton className="h-5 w-24 mb-3" />
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <Skeleton className="h-[320px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPI Cards */}
      {fetched && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {([
            { label: "Volume de Chamadas", value: kpis.totalCalls.toLocaleString("pt-BR"), icon: Phone, accent: "bg-violet-500/10 text-violet-400" },
            { label: "Duração Total", value: fmtDuration(kpis.totalDuration), icon: Clock, accent: "bg-sky-500/10 text-sky-400" },
            { label: "Custo Médio/Min", value: fmtUSD(kpis.avgCostPerMin), icon: BarChart3, accent: "bg-amber-500/10 text-amber-400" },
            { label: "Custo Total (USD)", value: fmtUSD(kpis.totalCost), icon: DollarSign, accent: "bg-emerald-500/10 text-emerald-400" },
            { label: "Taxa de Sucesso", value: `${kpis.successRate.toFixed(1)}%`, icon: Activity, accent: "bg-primary/10 text-primary" },
          ] as const).map(kpi => (
            <Card key={kpi.label} className="border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", kpi.accent)}>
                    <kpi.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stacked Area Chart */}
      {fetched && !loading && chartData.length > 0 && (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Evolução de Custos</CardTitle>
              </div>
              {/* Granularity selector */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                {(["daily", "weekly", "monthly"] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                      granularity === g
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {g === "daily" ? "Diário" : g === "weekly" ? "Semanal" : "Mensal"}
                  </button>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-2">
              {[
                { label: "LLM", color: "hsl(195, 80%, 50%)" },
                { label: "Vapi Fees", color: "hsl(270, 60%, 60%)" },
                { label: "Telefonia", color: "hsl(160, 60%, 50%)" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLLM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradVapi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradTransport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160, 60%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160, 60%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis
                  dataKey="day"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  dy={8}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={v => `$${v}`}
                  dx={-4}
                />
                <RechartsTooltip content={<VapiChartTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="llm"
                  name="LLM"
                  stackId="costs"
                  stroke="hsl(195, 80%, 50%)"
                  strokeWidth={1.5}
                  fill="url(#gradLLM)"
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(195, 80%, 50%)", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="vapi"
                  name="Vapi Fees"
                  stackId="costs"
                  stroke="hsl(270, 60%, 60%)"
                  strokeWidth={1.5}
                  fill="url(#gradVapi)"
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(270, 60%, 60%)", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="transport"
                  name="Telefonia"
                  stackId="costs"
                  stroke="hsl(160, 60%, 50%)"
                  strokeWidth={1.5}
                  fill="url(#gradTransport)"
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(160, 60%, 50%)", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {fetched && !loading && chartData.length === 0 && (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <Phone className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ── Smart Tooltip ── */
const VapiChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload || {};
  const totalCost = (data.llm || 0) + (data.vapi || 0) + (data.transport || 0);
  const totalMin = (data.duration || 0) / 60;
  const avgPerMin = totalMin > 0 ? totalCost / totalMin : 0;

  const layers = [
    { label: "LLM", value: data.llm || 0, color: "hsl(195, 80%, 50%)" },
    { label: "Vapi Fees", value: data.vapi || 0, color: "hsl(270, 60%, 60%)" },
    { label: "Telefonia", value: data.transport || 0, color: "hsl(160, 60%, 50%)" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl px-4 py-3 min-w-[200px]">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {layers.map(l => (
          <div key={l.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </div>
            <span className="text-xs font-semibold text-foreground">US$ {l.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="h-px bg-border/50 my-2" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Total</span>
        <span className="text-sm font-bold text-foreground">US$ {totalCost.toFixed(2)}</span>
      </div>
      {totalMin > 0 && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{totalMin.toFixed(1)} min · média</span>
          <span className="text-[10px] font-medium text-muted-foreground">US$ {avgPerMin.toFixed(2)}/min</span>
        </div>
      )}
    </div>
  );
};

export default VapiMetricsTab;

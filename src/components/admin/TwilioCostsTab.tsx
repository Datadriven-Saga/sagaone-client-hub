import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, Activity, AlertTriangle,
  TrendingUp, CheckCircle2, XCircle, PhoneOff, PhoneMissed
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";

const fmtUSD = (v: number) => `US$ ${v.toFixed(2)}`;
const fmtMinutes = (v: number) => {
  if (v >= 60) {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return m > 0 ? `${h.toLocaleString("pt-BR")}h ${m}min` : `${h.toLocaleString("pt-BR")}h`;
  }
  return `${v.toFixed(1)} min`;
};

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl px-4 py-3 min-w-[160px]">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-semibold text-foreground">
            {fmtUSD(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── KPI Card ── */
const KPICard = ({
  label, value, icon: Icon, accentClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accentClass?: string;
}) => (
  <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors">
    <CardContent className="pt-5 pb-4 px-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "flex items-center justify-center h-7 w-7 rounded-lg",
          accentClass || "bg-primary/10 text-primary"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </CardContent>
  </Card>
);

/* ── Status Badge ── */
const StatusBadge = ({
  label, count, icon: Icon, variant,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  variant: "success" | "warning" | "error" | "info" | "muted";
}) => {
  if (count <= 0) return null;

  const styles: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    muted: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-full", styles[variant])}>
      <Icon className="h-3 w-3" />
      {label}: {count.toLocaleString("pt-BR")}
    </Badge>
  );
};

const TwilioCostsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [dailyChart, setDailyChart] = useState<any[]>([]);

  const invokeWithRetry = async (functionName: string, body: any) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (!error) return data;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 800));
    }
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const fetchData = async () => {
    setLoading(true);
    setFetched(true);

    const body = {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      phone: phone || undefined,
    };

    try {
      const data = await invokeWithRetry("fetch-twilio-metrics", body);
      setSummary(data?.summary || null);
      setDailyChart(data?.dailyChart || []);
      if (data?.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }));
      }
    } catch (e: any) {
      toast.error("Erro Twilio: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    if (!summary) return { totalCost: 0, totalMinutes: 0, totalCalls: 0, completedRate: 0 };
    const totalMin = summary.totalDuration / 60;
    return {
      totalCost: summary.usageCost ?? summary.totalCost,
      totalMinutes: summary.usageMinutes ?? totalMin,
      totalCalls: summary.totalCalls,
      completedRate: summary.totalCalls > 0 ? (summary.completedCount / summary.totalCalls) * 100 : 0,
    };
  }, [summary]);

  const chartFormatted = useMemo(() => {
    return dailyChart.map((d: any) => {
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
  }, [dailyChart]);

  return (
    <div className="space-y-5 pt-2">
      {/* Delay warning */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        <span className="text-muted-foreground">
          Os custos de chamadas recentes na Twilio podem levar alguns minutos para serem processados e refletidos nos valores abaixo.
        </span>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Buscar por telefone</Label>
              <Input
                placeholder="Ex: 11999998888"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="bg-background/50 border-border/60"
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
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
              <Skeleton className="h-[280px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPIs */}
      {fetched && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Custo Total (USD)"
            value={fmtUSD(kpis.totalCost)}
            icon={DollarSign}
            accentClass="bg-emerald-500/10 text-emerald-400"
          />
          <KPICard
            label="Duração Total"
            value={fmtMinutes(kpis.totalMinutes)}
            icon={Clock}
            accentClass="bg-sky-500/10 text-sky-400"
          />
          <KPICard
            label="Volume de Chamadas"
            value={kpis.totalCalls.toLocaleString("pt-BR")}
            icon={Phone}
            accentClass="bg-violet-500/10 text-violet-400"
          />
          <KPICard
            label="Taxa de Conectividade"
            value={`${kpis.completedRate.toFixed(1)}%`}
            icon={Activity}
            accentClass="bg-amber-500/10 text-amber-400"
          />
        </div>
      )}

      {/* Status badges */}
      {fetched && !loading && summary && (
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Completed" count={summary.completedCount} icon={CheckCircle2} variant="success" />
          <StatusBadge label="Busy" count={summary.busyCount} icon={PhoneOff} variant="warning" />
          <StatusBadge label="Failed" count={summary.failedCount} icon={XCircle} variant="error" />
          <StatusBadge label="No-answer" count={summary.noAnswerCount} icon={PhoneMissed} variant="info" />
          <StatusBadge label="Canceled" count={summary.canceledCount} icon={Phone} variant="muted" />
        </div>
      )}

      {/* Area Chart */}
      {fetched && !loading && chartFormatted.length > 0 && (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Evolução Diária de Custos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartFormatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="twilioCostGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.4}
                  vertical={false}
                />
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
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Custo"
                  stroke="hsl(195, 80%, 50%)"
                  strokeWidth={2.5}
                  fill="url(#twilioCostGradient)"
                  dot={{ r: 3.5, fill: "hsl(195, 80%, 50%)", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "hsl(195, 80%, 50%)", stroke: "hsl(var(--card))", strokeWidth: 2.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {fetched && !loading && chartFormatted.length === 0 && (
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

export default TwilioCostsTab;

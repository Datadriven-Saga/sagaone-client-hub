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
  CalendarIcon, Search, Loader2, Phone, DollarSign, Clock, Activity, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const fmtUSD = (v: number) => `US$ ${v.toFixed(2)}`;

const TwilioCostsTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [dailyChart, setDailyChart] = useState<any[]>([]);

  const fetchData = async () => {
    setLoadingSummary(true);
    setLoadingCalls(true);
    setPage(0);
    setFetched(true);

    const body = {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      phone: phone || undefined,
    };

    try {
      const { data, error } = await supabase.functions.invoke("fetch-twilio-metrics", { body });
      if (error) throw error;

      setSummary(data?.summary || null);
      setDailyChart(data?.dailyChart || []);
      setLoadingSummary(false);

      setCalls(data?.calls || []);
      setLoadingCalls(false);

      if (data?.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }));
      }
    } catch (e: any) {
      toast.error("Erro Twilio: " + (e.message || "Erro desconhecido"));
      setLoadingSummary(false);
      setLoadingCalls(false);
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
    return dailyChart.map((d: any) => ({
      ...d,
      day: d.date?.length >= 10 ? format(new Date(d.date + "T00:00:00"), "dd/MM") : d.date,
    }));
  }, [dailyChart]);

  const paginatedCalls = calls.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(calls.length / ITEMS_PER_PAGE);
  const loading = loadingSummary || loadingCalls;

  return (
    <div className="space-y-6">
      {/* Delay warning */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm text-yellow-200">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
        <span>Os custos de chamadas recentes na Twilio podem levar alguns minutos para serem processados e refletidos nos valores abaixo.</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Buscar por telefone</Label>
              <Input placeholder="Ex: 11999998888" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
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
        </CardContent>
      </Card>

      {/* Loading Summary */}
      {loadingSummary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
      )}

      {/* KPIs */}
      {fetched && !loadingSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Gasto (USD)", value: fmtUSD(kpis.totalCost), icon: DollarSign },
            { label: "Total de Minutos", value: `${kpis.totalMinutes.toFixed(1)} min`, icon: Clock },
            { label: "Volume de Chamadas", value: kpis.totalCalls.toLocaleString("pt-BR"), icon: Phone },
            { label: "Taxa de Conectividade", value: `${kpis.completedRate.toFixed(1)}%`, icon: Activity },
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

      {/* Status breakdown */}
      {fetched && !loadingSummary && summary && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Completed", count: summary.completedCount, color: "bg-green-500/10 text-green-400 border-green-500/20" },
            { label: "Busy", count: summary.busyCount, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
            { label: "Failed", count: summary.failedCount, color: "bg-red-500/10 text-red-400 border-red-500/20" },
            { label: "No-answer", count: summary.noAnswerCount, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            { label: "Canceled", count: summary.canceledCount, color: "bg-muted text-muted-foreground border-border" },
          ].filter(s => s.count > 0).map(s => (
            <Badge key={s.label} variant="outline" className={cn("px-3 py-1 text-xs border", s.color)}>
              {s.label}: {s.count}
            </Badge>
          ))}
        </div>
      )}

      {/* Chart */}
      {fetched && !loadingSummary && chartFormatted.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Custo Diário Twilio</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtUSD(v), name]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="cost" name="Custo (USD)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {fetched && !loadingSummary && chartFormatted.length === 0 && !loadingCalls && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum dado encontrado para o período selecionado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TwilioCostsTab;

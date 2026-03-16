import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPhone } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, DollarSign, Phone, Loader2, Cpu, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type DailyCostsMap = Record<string, { twilio: number; vapi: number }>;

interface CostSummary {
  totalCalls: number;
  totalCost: number;
  totalDuration: number;
  twilioCost: number;
  vapiCost: number;
  twilioCount: number;
  vapiCount: number;
  errorCount: number;
  isPartial: boolean;
}

const fmtUSD = (v: number) => `US$ ${v.toFixed(2)}`;

const GastosGeraisTab = () => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [serverSummary, setServerSummary] = useState<CostSummary | null>(null);
  const [dailyCosts, setDailyCosts] = useState<DailyCostsMap>({});
  const [agentPhones, setAgentPhones] = useState<{ telefone: string; nome: string; display: string }[]>([]);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const loadAgentPhones = async () => {
      const { data } = await supabase
        .from("agentes_ia")
        .select("telefone, nome")
        .ilike("nome", "%Ligação%")
        .not("telefone", "is", null);

      if (!data) return;

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
    };

    loadAgentPhones();
  }, []);

  const invokeWithFallback = async (payload: { phone: string; startDate: string; endDate: string; source: "unified" }) => {
    const { data, error } = await supabase.functions.invoke("fetch-call-costs", { body: payload });
    if (!error) return data;

    const params = new URLSearchParams({
      phone: payload.phone,
      startDate: payload.startDate,
      endDate: payload.endDate,
      source: payload.source,
    });

    const fallbackRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-call-costs?${params.toString()}`);
    if (!fallbackRes.ok) {
      throw new Error(`Edge fallback HTTP ${fallbackRes.status}`);
    }

    return await fallbackRes.json();
  };

  const fetchData = async () => {
    setLoading(true);

    const payload = {
      phone: phone === "all" ? "" : phone,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      source: "unified" as const,
    };

    try {
      let responseData: any = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          responseData = await invokeWithFallback(payload);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 800));
          }
        }
      }

      if (lastError) throw lastError;

      setDailyCosts(responseData?.dailyCosts || {});
      setServerSummary(responseData?.summary || null);
      setFetched(true);

      if (responseData?.warnings?.length) {
        responseData.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }));
      }
    } catch (e: any) {
      toast.error("Erro ao buscar dados: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    if (!serverSummary) {
      return { totalCost: 0, vapiCost: 0, twilioCost: 0, avgCostPerCall: 0 };
    }

    const avg = serverSummary.totalCalls > 0 ? serverSummary.totalCost / serverSummary.totalCalls : 0;
    return {
      totalCost: serverSummary.totalCost || 0,
      vapiCost: serverSummary.vapiCost || 0,
      twilioCost: serverSummary.twilioCost || 0,
      avgCostPerCall: avg,
    };
  }, [serverSummary]);

  const chartData = useMemo(() => {
    return Object.entries(dailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => ({
        day: format(new Date(`${day}T12:00:00`), "dd/MM"),
        Twilio: +(values.twilio || 0).toFixed(4),
        Vapi: +(values.vapi || 0).toFixed(4),
        Total: +((values.twilio || 0) + (values.vapi || 0)).toFixed(4),
      }));
  }, [dailyCosts]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Telefone do Agente</Label>
              <Select value={phone} onValueChange={setPhone}>
                <SelectTrigger><SelectValue placeholder="Todos os agentes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os agentes</SelectItem>
                  {agentPhones.map((a, i) => (
                    <SelectItem key={i} value={a.telefone}>{a.nome} — {a.display}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
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
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
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

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-72 w-full" /></CardContent></Card>
        </div>
      )}

      {fetched && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Custo Total (Geral)", value: fmtUSD(kpis.totalCost), icon: DollarSign },
            { label: "Custo Vapi", value: fmtUSD(kpis.vapiCost), icon: Cpu },
            { label: "Custo Twilio", value: fmtUSD(kpis.twilioCost), icon: Phone },
            { label: "Custo Médio p/ Ligação", value: fmtUSD(kpis.avgCostPerCall), icon: Calculator },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <kpi.icon className="h-3.5 w-3.5 shrink-0" /> {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {fetched && !loading && chartData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Evolução diária de custos — Twilio x Vapi</CardTitle>
            {serverSummary?.isPartial && <Badge variant="outline">Resultado parcial</Badge>}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  yAxisId="twilio"
                  orientation="left"
                  fontSize={12}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  yAxisId="vapi"
                  orientation="right"
                  fontSize={12}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtUSD(v), name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Line yAxisId="twilio" type="monotone" dataKey="Twilio" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                <Line yAxisId="vapi" type="monotone" dataKey="Vapi" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {fetched && !loading && chartData.length === 0 && (
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

export default GastosGeraisTab;

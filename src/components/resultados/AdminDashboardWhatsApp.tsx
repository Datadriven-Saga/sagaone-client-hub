import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  MessageSquare,
  Send,
  MessageCircle,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  TrendingUp,
  BarChart3,
  Phone,
  Store,
  AlertTriangle,
  Info,
  Search,
  ChevronDown,
  X,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

// ── Interfaces ──────────────────────────────────────────────
interface AdminEvent {
  id_evento: number;
  nome: string;
  empresa_nome: string;
  data_inicio: string | null;
  data_fim: string | null;
}

interface AdminResultItem {
  event_id: number;
  event_nome: string;
  total_base: number;
  msg_enviada: number;
  msg_entregue: number;
  msg_lida: number;
  msg_respondida: number;
  agendado: number;
  optout: number;
  negativa_clara: number;
  gasto_total_dolar: number;
  gasto_total_real: number;
  templates: TemplateData[];
}

interface TemplateData {
  template_nome: string;
  valor_em_dolar: number;
  valor_em_real: number;
  tipo_disparo: string;
}

interface AdminApiResponse {
  total_eventos: number;
  rates_BRL: number;
  data_conversao: string;
  resultados: Array<{
    event_id: number;
    event_nome: string;
    total_base: string;
    msg_enviada: string;
    msg_entregue: string;
    msg_lida: string;
    msg_respondida: string;
    agendado: string;
    optout: string;
    negativa_clara: string;
    gasto_total_dolar?: string;
    gasto_total_real?: string;
    gasto_total?: string;
    templates?: Array<{
      template_nome: string;
      valor_em_dolar?: number;
      valor_em_real?: number;
      tipo_disparo: string;
    }>;
  }>;
}

// ── Helpers ─────────────────────────────────────────────────
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pctFmt = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const numFmt = (n: number) => n.toLocaleString("pt-BR");
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

const PAGE_SIZE = 10;

// ── Component ───────────────────────────────────────────────
export const AdminDashboardWhatsApp = () => {
  // Event list state
  const [allEvents, setAllEvents] = useState<AdminEvent[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Selection & search
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Results
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<AdminResultItem[]>([]);
  const [ratesBRL, setRatesBRL] = useState<number | null>(null);
  const [dataConversao, setDataConversao] = useState<string | null>(null);
  const [totalEventos, setTotalEventos] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showBRL, setShowBRL] = useState(false);

  // ── Fetch all IA WhatsApp events (paginated from DB) ──────
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoadingEvents(true);

        const { data, error } = await supabase
          .from("prospeccoes")
          .select(`
            id,
            titulo,
            event_id_pri,
            data_inicio,
            data_fim,
            empresas!inner(nome_empresa)
          `)
          .eq("canal", "Whatsapp")
          .not("event_id_pri", "is", null)
          .order("data_inicio", { ascending: false })
          .limit(500);

        if (error) throw error;

        const events: AdminEvent[] = (data || [])
          .map((p: any) => ({
            id_evento: Number(p.event_id_pri),
            nome: p.titulo || `Evento ${p.event_id_pri}`,
            empresa_nome: p.empresas?.nome_empresa || "",
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
          }))
          .filter((e) => Number.isFinite(e.id_evento) && e.id_evento > 0);

        setAllEvents(events);
      } catch (error) {
        console.error("Erro ao buscar eventos admin:", error);
        toast.error("Erro ao carregar eventos");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  // ── Filtered & visible events ─────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!searchFilter) return allEvents;
    const lower = searchFilter.toLowerCase();
    return allEvents.filter(
      (e) =>
        e.nome.toLowerCase().includes(lower) ||
        e.empresa_nome.toLowerCase().includes(lower) ||
        String(e.id_evento).includes(lower)
    );
  }, [allEvents, searchFilter]);

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount]
  );

  const hasMore = visibleCount < filteredEvents.length;

  // ── Toggle selection ──────────────────────────────────────
  const toggleEvent = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredEvents.map((e) => e.id_evento)));
  };

  const selectNone = () => setSelectedIds(new Set());

  // ── Fetch admin results ───────────────────────────────────
  const fetchResults = useCallback(async () => {
    // Build payload based on priority: keyword > multi-select
    const trimmedKeyword = keyword.trim();
    let payload: Record<string, unknown> = {};

    if (trimmedKeyword) {
      payload = { keyword: trimmedKeyword };
    } else if (selectedIds.size > 0) {
      const ids = Array.from(selectedIds);
      if (ids.length === 1) {
        payload = { id_evento: ids[0] };
      } else {
        payload = { id_eventos: ids };
      }
    } else {
      toast.error("Selecione eventos ou insira uma palavra-chave para consultar.");
      return;
    }

    try {
      setLoading(true);
      console.log("🔑 Admin WhatsApp query:", payload);

      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: {
          ...payload,
          webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/dashboard-evento-pri-whats-adm",
        },
      });

      if (error) {
        console.error("Admin WhatsApp proxy error:", error);
        toast.error("Erro ao consultar endpoint administrativo");
        return;
      }

      console.log("🔑 Admin WhatsApp raw response:", JSON.stringify(data)?.substring(0, 1000));

      // Parse response – handle multiple wrapper formats
      let parsed: AdminApiResponse | null = null;

      const tryParse = (obj: any): AdminApiResponse | null => {
        if (obj && typeof obj === "object" && Array.isArray(obj.resultados)) return obj;
        return null;
      };

      parsed = tryParse(data);
      if (!parsed && data?.data) parsed = tryParse(data.data);
      if (!parsed && Array.isArray(data) && data.length > 0) parsed = tryParse(data[0]);

      if (!parsed) {
        console.warn("Formato de resposta inesperado:", data);
        toast.error("Resposta da API em formato inesperado");
        return;
      }

      // Map resultados
      const items: AdminResultItem[] = parsed.resultados.map((r) => ({
        event_id: Number(r.event_id),
        event_nome: r.event_nome || `Evento ${r.event_id}`,
        total_base: Number(r.total_base) || 0,
        msg_enviada: Number(r.msg_enviada) || 0,
        msg_entregue: Number(r.msg_entregue) || 0,
        msg_lida: Number(r.msg_lida) || 0,
        msg_respondida: Number(r.msg_respondida) || 0,
        agendado: Number(r.agendado) || 0,
        optout: Number(r.optout) || 0,
        negativa_clara: Number(r.negativa_clara) || 0,
        gasto_total_dolar: Number(r.gasto_total_dolar) || 0,
        gasto_total_real: Number(r.gasto_total_real) || Number(r.gasto_total) || 0,
        templates: (r.templates || []).map((t) => ({
          template_nome: t.template_nome,
          valor_em_dolar: Number(t.valor_em_dolar) || 0,
          valor_em_real: Number(t.valor_em_real) || 0,
          tipo_disparo: t.tipo_disparo,
        })),
      }));

      setResultados(items);
      setRatesBRL(Number(parsed.rates_BRL) || null);
      setDataConversao(parsed.data_conversao || null);
      setTotalEventos(parsed.total_eventos || items.length);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Admin WhatsApp fetch error:", err);
      toast.error("Erro ao consultar dados administrativos");
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedIds]);

  // ── Aggregated metrics ────────────────────────────────────
  const aggregated = useMemo(() => {
    if (resultados.length === 0) return null;
    const agg = {
      total_base: 0,
      msg_enviada: 0,
      msg_entregue: 0,
      msg_lida: 0,
      msg_respondida: 0,
      agendado: 0,
      optout: 0,
      negativa_clara: 0,
      gasto_total_dolar: 0,
      gasto_total_real: 0,
    };

    resultados.forEach((r) => {
      agg.total_base += r.total_base;
      agg.msg_enviada += r.msg_enviada;
      agg.msg_entregue += r.msg_entregue;
      agg.msg_lida += r.msg_lida;
      agg.msg_respondida += r.msg_respondida;
      agg.agendado += r.agendado;
      agg.optout += r.optout;
      agg.negativa_clara += r.negativa_clara;
      agg.gasto_total_dolar += r.gasto_total_dolar;
      agg.gasto_total_real += r.gasto_total_real;
    });

    return agg;
  }, [resultados]);

  // ── Money formatter ───────────────────────────────────────
  const moneyVal = useCallback(
    (usd: number, brl?: number) => (showBRL ? fmtBRL(brl ?? usd) : fmtUSD(usd)),
    [showBRL]
  );

  const gastoEvento = useCallback(
    (r: AdminResultItem) => (showBRL ? r.gasto_total_real : r.gasto_total_dolar),
    [showBRL]
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  // ── KPI builder from aggregated ────────────────────────
  const kpiCards = useMemo(() => {
    if (!aggregated) return [];
    const a = aggregated;
    const gastoAtivo = showBRL ? a.gasto_total_real : a.gasto_total_dolar;
    const taxaEntrega = safeDiv(a.msg_entregue, a.msg_enviada);
    const taxaResposta = safeDiv(a.msg_respondida, a.msg_lida);
    const taxaLeitura = safeDiv(a.msg_lida, a.msg_entregue);
    const taxaAgendBase = safeDiv(a.agendado, a.total_base);
    const cpoEntregue = safeDiv(gastoAtivo, a.msg_entregue);
    const cpoRespondido = safeDiv(gastoAtivo, a.msg_respondida);
    const cpoAgendado = safeDiv(gastoAtivo, a.agendado);

    return [
      { label: "Total da base", value: numFmt(a.total_base), hint: `Enviadas: ${pctFmt(safeDiv(a.msg_enviada, a.total_base))}`, icon: <MessageSquare className="h-4 w-4" /> },
      { label: "Mensagens entregues", value: numFmt(a.msg_entregue), pctVal: taxaEntrega, pctSuffix: "das enviadas", hint: `Custo/entregue: ${showBRL ? fmtBRL(cpoEntregue) : fmtUSD(cpoEntregue)}`, icon: <CheckCircle2 className="h-4 w-4" /> },
      { label: "Leads responderam", value: numFmt(a.msg_respondida), pctVal: taxaResposta, pctSuffix: "das lidas", hint: `Custo/respondido: ${showBRL ? fmtBRL(cpoRespondido) : fmtUSD(cpoRespondido)}`, icon: <MessageCircle className="h-4 w-4" /> },
      { label: "Leads agendados", value: numFmt(a.agendado), pctVal: taxaAgendBase, hint: `CPL agendado: ${showBRL ? fmtBRL(cpoAgendado) : fmtUSD(cpoAgendado)}`, threshold: 0.03, icon: <CalendarCheck className="h-4 w-4" /> },
      { label: `Gasto total (${showBRL ? "BRL" : "USD"})`, value: showBRL ? fmtBRL(gastoAtivo) : fmtUSD(gastoAtivo), hint: `Custo/entregue: ${showBRL ? fmtBRL(cpoEntregue) : fmtUSD(cpoEntregue)}`, icon: <DollarSign className="h-4 w-4" /> },
      { label: "Taxa de leitura", value: pctFmt(taxaLeitura), hint: `${numFmt(a.msg_lida)} de ${numFmt(a.msg_entregue)} entregues`, icon: <Eye className="h-4 w-4" /> },
      { label: "Taxa resposta", value: pctFmt(taxaResposta), hint: `${numFmt(a.msg_respondida)} de ${numFmt(a.msg_lida)} lidas`, icon: <TrendingUp className="h-4 w-4" /> },
      { label: "Taxa agendamento", value: pctFmt(taxaAgendBase), pctVal: taxaAgendBase, hint: taxaAgendBase * 100 > 3 ? "✓ Acima de 3%" : "✕ Abaixo de 3%", threshold: 0.03, useValueColor: true, icon: <BarChart3 className="h-4 w-4" /> },
    ];
  }, [aggregated, showBRL]);

  // ── Funnel steps from aggregated ───────────────────────
  const funnelSteps = useMemo(() => {
    if (!aggregated) return [];
    const a = aggregated;
    return [
      { name: "Total da base", count: a.total_base, desc: "Total de leads nos eventos", key: "base" },
      { name: "Mensagem enviada", count: a.msg_enviada, desc: "Total de mensagens enviadas", key: "enviada" },
      { name: "Mensagem entregue", count: a.msg_entregue, desc: "Mensagens entregues", key: "entregue" },
      { name: "Mensagem lida", count: a.msg_lida, desc: "Mensagens lidas", key: "lida" },
      { name: "Mensagem respondida", count: a.msg_respondida, desc: "Leads que responderam", key: "respondida" },
      { name: "Agendado", count: a.agendado, desc: "Leads agendados", key: "agendado" },
    ];
  }, [aggregated]);

  const losses = useMemo(() => {
    if (!aggregated) return [];
    return [
      { name: "Opt-out", count: aggregated.optout, desc: "Leads que pediram para sair" },
      { name: "Negativa clara", count: aggregated.negativa_clara, desc: "Objeção explícita" },
    ].filter((l) => l.count > 0);
  }, [aggregated]);

  const leadBase = aggregated?.total_base || 1;

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Visão Administrativa — WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Consulta agregada de todos os eventos IA WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* USD/BRL Toggle */}
          <TooltipProvider>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/30">
              <span className={`text-xs font-bold ${!showBRL ? "text-primary" : "text-muted-foreground"}`}>USD</span>
              <Switch checked={showBRL} onCheckedChange={setShowBRL} className="data-[state=checked]:bg-primary" />
              <span className={`text-xs font-bold ${showBRL ? "text-primary" : "text-muted-foreground"}`}>BRL</span>
              {ratesBRL && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      Cotação: 1 USD = R$ {ratesBRL.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                      {dataConversao && `, data: ${dataConversao}`}.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>

          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {lastUpdate.toLocaleString("pt-BR")}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Selection & Search block ────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Seleção de eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Keyword search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Buscar por palavra-chave (ex: Auto Show, 1sem)..."
                className="pl-10"
              />
              {keyword && (
                <Button variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setKeyword("")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button onClick={fetchResults} disabled={loading && !keyword.trim() && selectedIds.size === 0} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Preencha a palavra-chave para buscar por nome, ou selecione eventos abaixo. A palavra-chave tem prioridade.
          </p>

          {/* Event list filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Filtrar lista de eventos..."
              className="pl-10"
            />
            {searchFilter && (
              <Button variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setSearchFilter("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>Selecionar todos</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectNone}>Limpar seleção</Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selecionado(s) de {filteredEvents.length} evento(s)
            </span>
          </div>

          {/* Event list */}
          {loadingEvents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[360px]">
                <div className="space-y-1">
                  {visibleEvents.map((event) => {
                    const isSelected = selectedIds.has(event.id_evento);
                    return (
                      <div
                        key={event.id_evento}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : "border border-transparent"}`}
                        onClick={() => toggleEvent(event.id_evento)}
                      >
                        <Checkbox checked={isSelected} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.nome}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.empresa_nome}</span>
                            <span>•</span>
                            <span>ID: {event.id_evento}</span>
                            {event.data_inicio && (
                              <>
                                <span>•</span>
                                <span>{formatDate(event.data_inicio)}{event.data_fim ? ` - ${formatDate(event.data_fim)}` : ""}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Carregar mais ({filteredEvents.length - visibleCount} restantes)
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Loading state ───────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {!loading && aggregated && resultados.length > 0 && (
        <>
          {/* Summary badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              {totalEventos} evento(s) retornado(s)
            </Badge>
            {ratesBRL && (
              <Badge variant="outline" className="text-xs">
                Cotação: 1 USD = R$ {ratesBRL.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                {dataConversao && ` (${dataConversao})`}
              </Badge>
            )}
          </div>

          {/* ── Consolidated KPIs ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpiCards.map((kpi, idx) => {
              let valueColor = "";
              if ((kpi as any).useValueColor && (kpi as any).threshold !== undefined) {
                const pv = kpi.pctVal ?? 0;
                valueColor = pv > (kpi as any).threshold ? "text-emerald-500" : "text-destructive";
              }
              return (
                <Card key={idx} className="bg-gradient-to-b from-card/80 to-card border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      {kpi.icon}
                      <span className="text-xs font-medium">{kpi.label}</span>
                    </div>
                    <p className={`text-xl font-extrabold ${valueColor}`}>{kpi.value}</p>
                    {kpi.pctVal !== undefined && !(kpi as any).useValueColor && (
                      <p className={`text-sm font-bold mt-1 ${
                        (kpi as any).threshold !== undefined
                          ? kpi.pctVal > (kpi as any).threshold ? "text-emerald-500" : "text-destructive"
                          : "text-primary"
                      }`}>
                        {pctFmt(kpi.pctVal)}
                        {(kpi as any).pctSuffix && <span className="text-xs text-muted-foreground font-normal ml-1">{(kpi as any).pctSuffix}</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Consolidated Funnel ───────────────────────────── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Funil consolidado</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {totalEventos} eventos agregados
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelSteps.map((step, idx) => {
                const prev = idx === 0 ? null : funnelSteps[idx - 1].count;
                const width = safeDiv(step.count, leadBase) * 100;
                const prevText = prev === null ? "—" : pctFmt(safeDiv(step.count, prev));
                const totalPct = safeDiv(step.count, leadBase);
                return (
                  <div key={step.key} className="border rounded-xl p-3 border-border/50 bg-background/30">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-extrabold text-sm">{idx + 1}. {step.name}</span>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-bold">{numFmt(step.count)}</Badge>
                        <Badge variant="outline" className="text-xs">Δ ant: {prevText}</Badge>
                        <Badge variant="outline" className="text-xs">{pctFmt(totalPct)} da base</Badge>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden mt-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500" style={{ width: `${Math.max(2, width)}%` }} />
                    </div>
                  </div>
                );
              })}

              {losses.map((loss) => (
                <div key={loss.name} className="border border-destructive/25 rounded-xl p-3 bg-destructive/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-extrabold text-sm flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        {loss.name}
                      </span>
                      <p className="text-xs text-muted-foreground">{loss.desc}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">{numFmt(loss.count)}</Badge>
                      <Badge variant="outline" className="text-xs">{pctFmt(safeDiv(loss.count, leadBase))} da base</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Individual event details (Accordion) ──────────── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Detalhamento por evento</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {resultados.map((r) => {
                  const evBase = r.total_base || 1;
                  const gasto = gastoEvento(r);
                  const taxaEntrega = safeDiv(r.msg_entregue, r.msg_enviada);
                  const taxaResp = safeDiv(r.msg_respondida, r.msg_lida);
                  const taxaAgend = safeDiv(r.agendado, r.total_base);

                  const sortedTpls = [...r.templates].sort((a, b) =>
                    showBRL ? b.valor_em_real - a.valor_em_real : b.valor_em_dolar - a.valor_em_dolar
                  );
                  const totalTplVal = sortedTpls.reduce((s, t) => s + (showBRL ? t.valor_em_real : t.valor_em_dolar), 0);
                  const maxTpl = sortedTpls.length > 0 ? (showBRL ? sortedTpls[0].valor_em_real : sortedTpls[0].valor_em_dolar) : 1;

                  return (
                    <AccordionItem key={r.event_id} value={String(r.event_id)} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm truncate block">{r.event_nome}</span>
                            <span className="text-xs text-muted-foreground">ID: {r.event_id}</span>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{numFmt(r.total_base)} leads</Badge>
                            <Badge variant="outline" className="text-xs">{numFmt(r.agendado)} agend.</Badge>
                            <Badge variant="outline" className="text-xs">{showBRL ? fmtBRL(gasto) : fmtUSD(gasto)}</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-4">
                        {/* Event KPIs mini */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: "Base", val: numFmt(r.total_base) },
                            { label: "Enviadas", val: numFmt(r.msg_enviada) },
                            { label: "Entregues", val: `${numFmt(r.msg_entregue)} (${pctFmt(taxaEntrega)})` },
                            { label: "Lidas", val: numFmt(r.msg_lida) },
                            { label: "Respondidas", val: `${numFmt(r.msg_respondida)} (${pctFmt(taxaResp)})` },
                            { label: "Agendados", val: `${numFmt(r.agendado)} (${pctFmt(taxaAgend)})` },
                            { label: "Opt-out", val: numFmt(r.optout) },
                            { label: `Gasto (${showBRL ? "BRL" : "USD"})`, val: showBRL ? fmtBRL(gasto) : fmtUSD(gasto) },
                          ].map((m) => (
                            <div key={m.label} className="bg-muted/30 rounded-lg p-2.5">
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                              <p className="text-sm font-bold">{m.val}</p>
                            </div>
                          ))}
                        </div>

                        {/* Templates */}
                        {sortedTpls.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-2">Templates ({showBRL ? "BRL" : "USD"})</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Template</TableHead>
                                  <TableHead className="text-xs">Tipo</TableHead>
                                  <TableHead className="text-xs text-right">Gasto</TableHead>
                                  <TableHead className="text-xs text-right">%</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedTpls.map((t) => {
                                  const tplVal = showBRL ? t.valor_em_real : t.valor_em_dolar;
                                  const pctOfTotal = safeDiv(tplVal, totalTplVal);
                                  const barW = safeDiv(tplVal, maxTpl) * 100;
                                  return (
                                    <TableRow key={t.template_nome}>
                                      <TableCell className="py-2">
                                        <span className="text-xs font-bold text-amber-500">{t.template_nome}</span>
                                        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mt-1">
                                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${Math.max(2, barW)}%` }} />
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs py-2">{t.tipo_disparo || "—"}</TableCell>
                                      <TableCell className="text-xs py-2 text-right">{showBRL ? fmtBRL(tplVal) : fmtUSD(tplVal)}</TableCell>
                                      <TableCell className="text-xs py-2 text-right">{pctFmt(pctOfTotal)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                              <TableFooter>
                                <TableRow>
                                  <TableCell className="font-bold text-xs">Total</TableCell>
                                  <TableCell />
                                  <TableCell className="font-bold text-xs text-right">{showBRL ? fmtBRL(totalTplVal) : fmtUSD(totalTplVal)}</TableCell>
                                  <TableCell className="font-bold text-xs text-right">100%</TableCell>
                                </TableRow>
                              </TableFooter>
                            </Table>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state after query */}
      {!loading && resultados.length === 0 && lastUpdate && (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
          <p className="text-sm text-muted-foreground">Tente outra palavra-chave ou selecione eventos diferentes.</p>
        </Card>
      )}
    </div>
  );
};

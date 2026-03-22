import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  Phone,
  PhoneCall,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Search,
  X,
  LayoutGrid,
  MapPin,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

// ── Interfaces ──────────────────────────────────────────────
interface LigacaoEvent {
  id_evento: number;
  nome: string;
  cidade: string;
  uf: string;
  marca: string;
  dealerid: string;
  telefone_pri: string;
  evt_status: boolean;
  data_inicio: string | null;
  data_fim: string | null;
}

interface LigacaoResultItem {
  event_id: number;
  event_nome: string;
  total_registros: number;
  leads_contatados: number;
  ligacao_atendida: number;
  status_agendado: number;
  tentativas_0: number;
  tentativas_1: number;
  tentativas_2: number;
  tentativas_maior_2: number;
  ligacao_erro: number;
  enviado_whatsapp: number;
  [key: string]: unknown;
}

// ── Helpers ─────────────────────────────────────────────────
const pctFmt = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const numFmt = (n: number) => n.toLocaleString("pt-BR");
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

const WEBHOOK_EVENTS = "https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-todos-eventos";
const WEBHOOK_SEARCH = "https://automatemaiawh.sagadatadriven.com.br/webhook/visao_administrativa";

const sortByStartDateDesc = (a: LigacaoEvent, b: LigacaoEvent) => {
  if (!a.data_inicio && !b.data_inicio) return 0;
  if (!a.data_inicio) return 1;
  if (!b.data_inicio) return -1;
  return new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
};

const normalizeEvents = (rawEvents: any[]): LigacaoEvent[] => {
  return rawEvents
    .filter((e: any) => e && (e.id_evento ?? e.event_id))
    .map((e: any) => ({
      id_evento: Number(e.id_evento ?? e.event_id),
      nome: e.nome || e.event_nome || `Evento ${e.id_evento ?? e.event_id}`,
      cidade: e.cidade || "",
      uf: e.uf || e.estado || "",
      marca: e.marca || "",
      dealerid: e.dealerid || e.dealer_id || "",
      telefone_pri: e.telefone_pri || "",
      evt_status: e.evt_status === true || e.evt_status === "true" || e.evt_status === "ativo",
      data_inicio: e.data_inicio || null,
      data_fim: e.data_fim || null,
    }))
    .sort(sortByStartDateDesc);
};

const extractEventRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.resultados)) return payload.resultados;
    if (Array.isArray(payload.eventos)) return payload.eventos;
  }
  return [];
};

const hasMetricFields = (row: any) => {
  if (!row || typeof row !== "object") return false;
  return [
    "total_registros",
    "tentativas_0",
    "ligacao_atendida",
    "status_agendado",
  ].some((field) => row[field] !== undefined && row[field] !== null);
};

const extractMetricRows = (payload: any): { rows: any[]; totalEventos: number } => {
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (first?.resultados && Array.isArray(first.resultados)) {
      return { rows: first.resultados, totalEventos: Number(first.total_eventos) || first.resultados.length };
    }
    if (payload.every((row: any) => hasMetricFields(row))) {
      return { rows: payload, totalEventos: payload.length };
    }
    return { rows: [], totalEventos: 0 };
  }
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.resultados)) {
      return { rows: payload.resultados, totalEventos: Number(payload.total_eventos) || payload.resultados.length };
    }
    if (payload.data && Array.isArray(payload.data.resultados)) {
      return { rows: payload.data.resultados, totalEventos: Number(payload.data.total_eventos) || payload.data.resultados.length };
    }
    if (payload.data && Array.isArray(payload.data)) {
      return { rows: payload.data, totalEventos: payload.data.length };
    }
  }
  return { rows: [], totalEventos: 0 };
};

// ── Component ───────────────────────────────────────────────
export const AdminDashboardLigacao = () => {
  // Event list state
  const [allEvents, setAllEvents] = useState<LigacaoEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Selection & search
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Results
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<LigacaoResultItem[]>([]);
  const [totalEventos, setTotalEventos] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ── Fetch all events via webhook ──────────────────────────
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoadingEvents(true);

        const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
          body: { webhook_url: WEBHOOK_EVENTS },
        });

        if (error) throw error;

        const events = normalizeEvents(extractEventRows(data));

        console.log(`📞 Admin Ligação: ${events.length} eventos carregados via webhook`);
        setAllEvents(events);
      } catch (error) {
        console.error("Erro ao buscar eventos ligação:", error);
        toast.error("Erro ao carregar eventos de ligação");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  // ── Filtered events ───────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!searchFilter) return allEvents;
    const lower = searchFilter.toLowerCase();
    return allEvents.filter(
      (e) =>
        e.nome.toLowerCase().includes(lower) ||
        e.cidade.toLowerCase().includes(lower) ||
        e.marca.toLowerCase().includes(lower) ||
        e.uf.toLowerCase().includes(lower) ||
        String(e.id_evento).includes(lower)
    );
  }, [allEvents, searchFilter]);

  const clearResults = useCallback(() => {
    setResultados([]);
    setTotalEventos(0);
    setLastUpdate(new Date());
  }, []);

  const fetchMetricsByIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      clearResults();
      return;
    }

    const payload = ids.length === 1 ? { id_evento: ids[0] } : { id_eventos: ids };

    try {
      setLoading(true);
      console.log("📞 Admin Ligação metrics query:", payload);

      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: {
          ...payload,
          webhook_url: WEBHOOK_SEARCH,
        },
      });

      if (error) {
        console.error("Admin Ligação proxy error:", error);
        toast.error("Erro ao consultar endpoint administrativo");
        return;
      }

      console.log("📞 Admin Ligação metrics raw response:", JSON.stringify(data)?.substring(0, 1000));

      const { rows, totalEventos: totalFromResponse } = extractMetricRows(data);

      if (rows.length === 0) {
        console.warn("Nenhuma métrica retornada:", data);
        toast.info("Nenhuma métrica retornada para os eventos selecionados");
        clearResults();
        return;
      }

      const items: LigacaoResultItem[] = rows
        .map((r: any) => ({
          event_id: Number(r.event_id || r.id_evento) || 0,
          event_nome: r.event_nome || r.nome || `Evento ${r.event_id || r.id_evento}`,
          total_base: Number(r.total_base || r.total) || 0,
          leads_contatados: Number(r.leads_contatados || r.contatados) || 0,
          ligacoes_feitas: Number(r.ligacoes_feitas || r.ligacoes) || 0,
          atendidos: Number(r.atendidos) || 0,
          agendados: Number(r.agendados || r.agendado) || 0,
          encerrados: Number(r.encerrados || r.encerrado) || 0,
        }))
        .filter((item) => item.event_id > 0);

      if (items.length === 0) {
        console.warn("Resposta sem campos de KPI válidos:", rows);
        toast.warning("A API retornou eventos sem campos de KPI");
        clearResults();
        return;
      }

      setResultados(items);
      setTotalEventos(totalFromResponse || items.length);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Admin Ligação metrics fetch error:", err);
      toast.error("Erro ao consultar dados administrativos");
    } finally {
      setLoading(false);
    }
  }, [clearResults]);

  const fetchEventIdsByKeyword = useCallback(async (searchKeyword: string): Promise<number[]> => {
    const trimmedKeyword = searchKeyword.trim();
    if (!trimmedKeyword) return [];

    console.log("📞 Admin Ligação keyword query:", { keyword: trimmedKeyword });

    const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: {
        keyword: trimmedKeyword,
        webhook_url: WEBHOOK_SEARCH,
      },
    });

    if (error) {
      console.error("Admin Ligação keyword proxy error:", error);
      throw error;
    }

    console.log("📞 Admin Ligação keyword raw response:", JSON.stringify(data)?.substring(0, 1000));

    const eventRows = extractEventRows(data);
    const keywordEvents = normalizeEvents(eventRows);

    if (keywordEvents.length > 0) {
      setAllEvents((prev) => {
        const merged = new Map(prev.map((event) => [event.id_evento, event]));
        keywordEvents.forEach((event) => merged.set(event.id_evento, event));
        return Array.from(merged.values()).sort(sortByStartDateDesc);
      });
    }

    return Array.from(
      new Set(
        eventRows
          .map((event: any) => Number(event?.id_evento ?? event?.event_id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );
  }, []);

  // ── Toggle selection ──────────────────────────────────────
  const toggleEvent = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    setSelectedIds(next);
    void fetchMetricsByIds(Array.from(next));
  };

  const selectAll = () => {
    const ids = filteredEvents.map((event) => event.id_evento);
    setSelectedIds(new Set(ids));
    void fetchMetricsByIds(ids);
  };

  const selectNone = () => {
    setSelectedIds(new Set());
    clearResults();
  };

  // ── Search + fetch admin results ──────────────────────────
  const fetchResults = useCallback(async () => {
    const trimmedKeyword = keyword.trim();

    try {
      if (trimmedKeyword) {
        const ids = await fetchEventIdsByKeyword(trimmedKeyword);

        if (ids.length === 0) {
          toast.info("Nenhum evento encontrado para essa palavra-chave");
          clearResults();
          return;
        }

        setSelectedIds(new Set(ids));
        await fetchMetricsByIds(ids);
        return;
      }

      if (selectedIds.size === 0) {
        toast.error("Selecione eventos ou insira uma palavra-chave para consultar.");
        return;
      }

      await fetchMetricsByIds(Array.from(selectedIds));
    } catch (error) {
      console.error("Admin Ligação search error:", error);
      toast.error("Erro ao buscar eventos por nome");
    }
  }, [keyword, selectedIds, fetchEventIdsByKeyword, fetchMetricsByIds, clearResults]);

  // ── Aggregated metrics ────────────────────────────────────
  const aggregated = useMemo(() => {
    if (resultados.length === 0) return null;
    const agg = {
      total_base: 0,
      leads_contatados: 0,
      ligacoes_feitas: 0,
      atendidos: 0,
      agendados: 0,
      encerrados: 0,
    };

    resultados.forEach((r) => {
      agg.total_base += r.total_base;
      agg.leads_contatados += r.leads_contatados;
      agg.ligacoes_feitas += r.ligacoes_feitas;
      agg.atendidos += r.atendidos;
      agg.agendados += r.agendados;
      agg.encerrados += r.encerrados;
    });

    return agg;
  }, [resultados]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  // ── KPI cards ─────────────────────────────────────────────
  const kpiCards = useMemo(() => {
    if (!aggregated) return [];
    const a = aggregated;
    const taxaContato = safeDiv(a.leads_contatados, a.total_base);
    const taxaAtendimento = safeDiv(a.atendidos, a.leads_contatados);
    const taxaAgendamento = safeDiv(a.agendados, a.total_base);

    return [
      { label: "Total da base", value: numFmt(a.total_base), hint: `Contatados: ${pctFmt(taxaContato)}`, icon: <Users className="h-4 w-4" /> },
      { label: "Leads contatados", value: numFmt(a.leads_contatados), pctVal: taxaContato, pctSuffix: "da base", icon: <Phone className="h-4 w-4" /> },
      { label: "Ligações feitas", value: numFmt(a.ligacoes_feitas), hint: `Média: ${numFmt(Math.round(safeDiv(a.ligacoes_feitas, a.leads_contatados)))} por lead`, icon: <PhoneCall className="h-4 w-4" /> },
      { label: "Atendidos", value: numFmt(a.atendidos), pctVal: taxaAtendimento, pctSuffix: "dos contatados", icon: <CheckCircle2 className="h-4 w-4" /> },
      { label: "Agendados", value: numFmt(a.agendados), pctVal: taxaAgendamento, hint: taxaAgendamento * 100 > 3 ? "✓ Acima de 3%" : "✕ Abaixo de 3%", threshold: 0.03, icon: <CalendarCheck className="h-4 w-4" /> },
      { label: "Encerrados", value: numFmt(a.encerrados), hint: `${pctFmt(safeDiv(a.encerrados, a.total_base))} da base`, icon: <XCircle className="h-4 w-4" /> },
      { label: "Taxa contato", value: pctFmt(taxaContato), hint: `${numFmt(a.leads_contatados)} de ${numFmt(a.total_base)}`, icon: <TrendingUp className="h-4 w-4" /> },
      { label: "Taxa agendamento", value: pctFmt(taxaAgendamento), pctVal: taxaAgendamento, hint: taxaAgendamento * 100 > 3 ? "✓ Acima de 3%" : "✕ Abaixo de 3%", threshold: 0.03, useValueColor: true, icon: <BarChart3 className="h-4 w-4" /> },
    ];
  }, [aggregated]);

  // ── Funnel steps ──────────────────────────────────────────
  const funnelSteps = useMemo(() => {
    if (!aggregated) return [];
    const a = aggregated;
    return [
      { name: "Total da base", count: a.total_base, desc: "Total de leads nos eventos", key: "base" },
      { name: "Leads contatados", count: a.leads_contatados, desc: "Leads que foram contatados", key: "contatados" },
      { name: "Ligações feitas", count: a.ligacoes_feitas, desc: "Total de ligações realizadas", key: "ligacoes" },
      { name: "Atendidos", count: a.atendidos, desc: "Leads que atenderam", key: "atendidos" },
      { name: "Agendados", count: a.agendados, desc: "Leads agendados", key: "agendados" },
    ];
  }, [aggregated]);

  const losses = useMemo(() => {
    if (!aggregated) return [];
    return [
      { name: "Encerrados", count: aggregated.encerrados, desc: "Leads encerrados sem agendamento" },
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
            Visão Administrativa — Ligação
          </h2>
          <p className="text-sm text-muted-foreground">
            Consulta agregada de todos os eventos de Ligação
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
                placeholder="Buscar por palavra-chave (ex: Feirão, Auto Show)..."
                className="pl-10"
              />
              {keyword && (
                <Button variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setKeyword("")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button onClick={fetchResults} disabled={loading || loadingEvents} className="shrink-0">
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
              onChange={(e) => setSearchFilter(e.target.value)}
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
              <ScrollArea className="h-[360px] rounded-md border border-border/50" onWheelCapture={(event) => event.stopPropagation()}>
                <div className="space-y-1">
                  {filteredEvents.map((event) => {
                    const isSelected = selectedIds.has(event.id_evento);
                    return (
                      <div
                        key={event.id_evento}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : "border border-transparent"}`}
                        onClick={() => toggleEvent(event.id_evento)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleEvent(event.id_evento)}
                          onClick={(event) => event.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{event.nome}</p>
                            <Badge variant={event.evt_status ? "default" : "secondary"} className="text-[10px] shrink-0">
                              {event.evt_status ? "Ativo" : "Inativo"}
                            </Badge>
                            {event.marca && (
                              <Badge variant="outline" className="text-[10px] shrink-0">{event.marca}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {event.cidade && (
                              <>
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{event.cidade}{event.uf ? `, ${event.uf}` : ""}</span>
                                <span>•</span>
                              </>
                            )}
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
                    {kpi.hint && <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>}
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
                  const taxaContato = safeDiv(r.leads_contatados, r.total_base);
                  const taxaAtend = safeDiv(r.atendidos, r.leads_contatados);
                  const taxaAgend = safeDiv(r.agendados, r.total_base);

                  return (
                    <AccordionItem key={r.event_id} value={String(r.event_id)} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <Phone className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm truncate block">{r.event_nome}</span>
                            <span className="text-xs text-muted-foreground">ID: {r.event_id}</span>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{numFmt(r.total_base)} leads</Badge>
                            <Badge variant="outline" className="text-xs">{numFmt(r.agendados)} agend.</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { label: "Base", val: numFmt(r.total_base) },
                            { label: "Contatados", val: `${numFmt(r.leads_contatados)} (${pctFmt(taxaContato)})` },
                            { label: "Ligações", val: numFmt(r.ligacoes_feitas) },
                            { label: "Atendidos", val: `${numFmt(r.atendidos)} (${pctFmt(taxaAtend)})` },
                            { label: "Agendados", val: `${numFmt(r.agendados)} (${pctFmt(taxaAgend)})` },
                            { label: "Encerrados", val: numFmt(r.encerrados) },
                          ].map((m) => (
                            <div key={m.label} className="bg-muted/30 rounded-lg p-2.5">
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                              <p className="text-sm font-bold">{m.val}</p>
                            </div>
                          ))}
                        </div>
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
          <Phone className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
          <p className="text-sm text-muted-foreground">Tente outra palavra-chave ou selecione eventos diferentes.</p>
        </Card>
      )}
    </div>
  );
};

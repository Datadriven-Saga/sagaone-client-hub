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
  Check,
  ChevronsUpDown,
  Phone,
  Store,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface DashboardWhatsAppTabProps {
  selectedEventId: string;
  selectedEventIdPri: string;
  onEventChange?: (eventId: string, eventIdPri: string) => void;
}

interface TemplateData {
  template_nome: string;
  valor_em_dolar: number;
  valor_em_real: number;
  tipo_disparo: string;
}

interface WebhookResponse {
  total_base: string;
  msg_enviada: string;
  msg_entregue: string;
  msg_lida: string;
  msg_respondida: string;
  agendado: string;
  optout: string;
  negativa_clara: string;
  gasto_total?: string;
  gasto_total_dolar?: string;
  gasto_total_real?: string;
  rates?: { BRL?: string };
  data_conversao?: string;
  templates: Array<{
    template_nome: string;
    valor_em_dolar?: number;
    valor_em_real?: number;
    tipo_disparo: string;
  }>;
}

interface DashboardData {
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
  rates_brl: number | null;
  data_conversao: string | null;
  templates: TemplateData[];
}

interface EventOption {
  id_evento: number;
  nome: string;
  empresa_nome?: string;
  prospeccao_id?: string;
}

interface AgentWhatsApp {
  id: string;
  nome: string;
  telefone: string;
}

// Helper functions
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pctFmt = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const numFmt = (n: number) => n.toLocaleString("pt-BR");
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export const DashboardWhatsAppTab = ({
  selectedEventId,
  selectedEventIdPri,
  onEventChange,
}: DashboardWhatsAppTabProps) => {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([Number(selectedEventIdPri)]);
  const [agent, setAgent] = useState<AgentWhatsApp | null>(null);
  const [eventsPopoverOpen, setEventsPopoverOpen] = useState(false);
  const [showBRL, setShowBRL] = useState(false);

  // Currency formatter based on toggle
  const fmtMoney = useCallback((usdVal: number, brlVal: number) => {
    return showBRL ? fmtBRL(brlVal) : fmtUSD(usdVal);
  }, [showBRL]);

  // Fetch WhatsApp agent for the company
  useEffect(() => {
    const fetchAgent = async () => {
      if (!activeCompany?.id) return;

      try {
        const { data: agenteEmpresasData, error } = await supabase
          .from("agente_empresas")
          .select("agente_id, agentes_ia!inner(id, nome, telefone, ativo)")
          .eq("empresa_id", activeCompany.id);

        if (error) {
          console.error("Error fetching agente_empresas:", error);
          return;
        }

        const allAgents = (agenteEmpresasData || []).map((ae: any) => ae.agentes_ia).filter((ag: any) => !!ag);

        const priWhatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || "").toLowerCase();
            const isWhatsApp = nome.includes("whatsapp") || nome.includes("wpp") || nome.includes("zap");
            const isPri = nome.includes("pri");
            return isWhatsApp && isPri;
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));

        const whatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || "").toLowerCase();
            return nome.includes("whatsapp") || nome.includes("wpp") || nome.includes("zap");
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));

        const chosen = priWhatsAppAgents[0] ?? whatsAppAgents[0];
        if (chosen) setAgent(chosen);
      } catch (error) {
        console.error("Error fetching WhatsApp agent:", error);
      }
    };

    fetchAgent();
  }, [activeCompany?.id]);

  // Fetch events only for active company (evita mistura de lojas)
  useEffect(() => {
    const fetchEvents = async () => {
      if (!agent?.telefone || !activeCompany?.id) {
        setEvents([]);
        setSelectedEventIds([]);
        return;
      }

      try {
        setLoadingEvents(true);

        const { data: prospeccoes, error: prospError } = await supabase
          .from("prospeccoes")
          .select(
            `
            id,
            titulo,
            event_id_pri,
            data_inicio,
            data_fim,
            empresas!inner(nome_empresa)
          `,
          )
          .eq("empresa_id", activeCompany.id)
          .eq("canal", "Whatsapp")
          .not("event_id_pri", "is", null)
          .order("data_inicio", { ascending: false });

        if (prospError) {
          console.error("Erro ao buscar prospecções WhatsApp:", prospError);
          toast.error("Erro ao buscar eventos");
          return;
        }

        const eventsList: EventOption[] = (prospeccoes || [])
          .map((p: any) => ({
            id_evento: Number(p.event_id_pri),
            nome: p.titulo || `Evento ${p.event_id_pri}`,
            empresa_nome: p.empresas?.nome_empresa || "",
            prospeccao_id: p.id,
          }))
          .filter((e) => Number.isFinite(e.id_evento) && e.id_evento > 0);

        setEvents(eventsList);

        setSelectedEventIds((prev) => {
          const availableIds = new Set(eventsList.map((e) => e.id_evento));
          const preferredId = Number(selectedEventIdPri);

          if (Number.isFinite(preferredId) && availableIds.has(preferredId)) {
            return [preferredId];
          }

          const stillValid = prev.filter((id) => availableIds.has(id));
          if (stillValid.length > 0) {
            return stillValid;
          }

          return eventsList[0] ? [eventsList[0].id_evento] : [];
        });
      } catch (error) {
        console.error("Erro ao carregar eventos WhatsApp:", error);
        toast.error("Erro ao carregar eventos");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [agent?.telefone, activeCompany?.id, selectedEventIdPri]);

  // Fetch dashboard data when selected events change
  useEffect(() => {
    if (selectedEventIds.length > 0) {
      fetchDashboardData();
    } else {
      setDashboardData(null);
    }
  }, [selectedEventIds]);

  const fetchDashboardData = useCallback(async () => {
    if (selectedEventIds.length === 0) return;

    try {
      setLoading(true);

      console.log("📊 Fetching WhatsApp dashboard for events:", selectedEventIds);

      const cleanPhone = agent?.telefone ? agent.telefone.replace(/\D/g, "") : "";

      let dealerId = "";
      if (activeCompany?.id) {
        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select("crm_id")
          .eq("id", activeCompany.id)
          .maybeSingle();

        if (empresaError) {
          console.warn("Não foi possível buscar crm_id da empresa ativa:", empresaError);
        } else {
          dealerId = String(empresaData?.crm_id || "").trim();
        }
      }

      const integrationErrors: string[] = [];

      const allResponses = await Promise.all(
        selectedEventIds.map(async (eventId) => {
          const payload: Record<string, unknown> = {
            endpoint: "dashboard-evento-pri-whats",
            id_evento: eventId,
            event_id: eventId,
            evento_id: eventId,
            empresa_id: activeCompany?.id ?? null,
          };

          if (cleanPhone) {
            payload.telefone_pri = cleanPhone;
          }

          if (dealerId) {
            payload.dealer_id = dealerId;
            payload.dealerid = dealerId;
          }

          const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
            body: payload,
          });

          console.log(`📊 WhatsApp evento ${eventId} response:`, JSON.stringify(data)?.substring(0, 500));

          if (error) {
            console.error(`Erro ao buscar métricas do evento ${eventId}:`, error);
            integrationErrors.push(`Evento ${eventId}: erro de integração`);
            return null;
          }

          // Try multiple response formats
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
            const item = data[0];
            if ("total_base" in item || "msg_enviada" in item) {
              return item as WebhookResponse;
            }
          }

          if (data && typeof data === "object" && !Array.isArray(data)) {
            if ("total_base" in data || "msg_enviada" in data) {
              return data as WebhookResponse;
            }
            // Handle nested data object
            if ("data" in data && typeof (data as any).data === "object") {
              const nested = (data as any).data;
              if ("total_base" in nested || "msg_enviada" in nested) {
                return nested as WebhookResponse;
              }
            }
          }

          const message =
            data && typeof data === "object" && "message" in data
              ? String((data as { message?: unknown }).message || "erro no workflow")
              : "formato de resposta inválido";

          integrationErrors.push(`Evento ${eventId}: ${message}`);
          console.warn(`Resposta inesperada do evento ${eventId}:`, data);
          return null;
        }),
      );

      // Aggregate external responses
      const aggregated: DashboardData = {
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
        rates_brl: null,
        data_conversao: null,
        templates: [],
      };

      const templateMap = new Map<string, TemplateData>();

      allResponses.forEach((resp) => {
        if (!resp) return;
        aggregated.total_base += Number(resp.total_base) || 0;
        aggregated.msg_enviada += Number(resp.msg_enviada) || 0;
        aggregated.msg_entregue += Number(resp.msg_entregue) || 0;
        aggregated.msg_lida += Number(resp.msg_lida) || 0;
        aggregated.msg_respondida += Number(resp.msg_respondida) || 0;
        aggregated.agendado += Number(resp.agendado) || 0;
        aggregated.optout += Number(resp.optout) || 0;
        aggregated.negativa_clara += Number(resp.negativa_clara) || 0;

        const gastoUSD = Number(resp.gasto_total_dolar) || 0;
        const gastoBRL = Number(resp.gasto_total_real) || Number(resp.gasto_total) || 0;
        aggregated.gasto_total_dolar += gastoUSD;
        aggregated.gasto_total_real += gastoBRL;

        if (resp.rates?.BRL) {
          aggregated.rates_brl = Number(resp.rates.BRL) || null;
        }
        if (resp.data_conversao) {
          aggregated.data_conversao = resp.data_conversao;
        }

        (resp.templates || []).forEach((t) => {
          const key = t.template_nome;
          const existing = templateMap.get(key);
          const tplUSD = Number(t.valor_em_dolar) || 0;
          const tplBRL = Number(t.valor_em_real) || 0;
          if (existing) {
            existing.valor_em_dolar += tplUSD;
            existing.valor_em_real += tplBRL;
          } else {
            templateMap.set(key, {
              template_nome: t.template_nome,
              valor_em_dolar: tplUSD,
              valor_em_real: tplBRL,
              tipo_disparo: t.tipo_disparo,
            });
          }
        });
      });

      aggregated.templates = Array.from(templateMap.values());

      // Total base usa o valor retornado pelo webhook (fonte de verdade para o dashboard WhatsApp)

      if (integrationErrors.length === selectedEventIds.length) {
        toast.error("Falha na API externa; exibindo base oficial do evento.");
      } else if (integrationErrors.length > 0) {
        toast.warning("Parte das métricas externas falhou; base local foi priorizada.");
      }

      console.log("📊 Dashboard WhatsApp aggregated:", aggregated);

      setDashboardData(aggregated);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedEventIds, activeCompany?.id, agent?.telefone, events]);

  const toggleEventSelection = (eventId: number) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      }
      return [...prev, eventId];
    });
  };

  const selectAllEvents = () => {
    setSelectedEventIds(events.map((e) => e.id_evento));
  };

  const selectNone = () => {
    setSelectedEventIds([]);
  };

  // Computed metrics
  const metrics = useMemo(() => {
    if (!dashboardData) return null;
    const d = dashboardData;

    const gastoAtivo = showBRL ? d.gasto_total_real : d.gasto_total_dolar;

    const taxaEntrega = safeDiv(d.msg_entregue, d.msg_enviada);
    const taxaResposta = safeDiv(d.msg_respondida, d.msg_lida);
    const taxaLeituraBase = safeDiv(d.msg_lida, d.msg_entregue);
    const taxaAgendBase = safeDiv(d.agendado, d.total_base);
    const taxaAgendResp = safeDiv(d.agendado, d.msg_respondida);

    const cpoEntregue = safeDiv(gastoAtivo, d.msg_entregue);
    const cpoRespondido = safeDiv(gastoAtivo, d.msg_respondida);
    const cpoAgendado = safeDiv(gastoAtivo, d.agendado);

    return {
      ...d,
      gastoAtivo,
      taxaEntrega,
      taxaResposta,
      taxaLeituraBase,
      taxaAgendBase,
      taxaAgendResp,
      cpoEntregue,
      cpoRespondido,
      cpoAgendado,
    };
  }, [dashboardData, showBRL]);

  // Currency format helper for active currency
  const money = useCallback((usd: number, brl: number) => {
    return showBRL ? fmtBRL(brl) : fmtUSD(usd);
  }, [showBRL]);

  const moneyVal = useCallback((val: number) => {
    return showBRL ? fmtBRL(val) : fmtUSD(val);
  }, [showBRL]);

  // KPI cards
  const kpiCards = useMemo(() => {
    if (!metrics) return [];
    const m = metrics;
    const taxaAgendPct = m.taxaAgendBase * 100;

    return [
      {
        label: "Total da base",
        value: numFmt(m.total_base),
        hint: `Enviadas: ${pctFmt(safeDiv(m.msg_enviada, m.total_base))}`,
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        label: "Mensagens entregues",
        value: numFmt(m.msg_entregue),
        pctVal: m.taxaEntrega,
        pctSuffix: "das enviadas",
        hint: `Custo/entregue: ${moneyVal(m.cpoEntregue)}`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: "Leads responderam",
        value: numFmt(m.msg_respondida),
        pctVal: m.taxaResposta,
        pctSuffix: "das lidas",
        hint: `Custo/respondido: ${moneyVal(m.cpoRespondido)}`,
        icon: <MessageCircle className="h-4 w-4" />,
      },
      {
        label: "Leads agendados",
        value: numFmt(m.agendado),
        pctVal: m.taxaAgendBase,
        hint: `CPL agendado: ${moneyVal(m.cpoAgendado)}`,
        threshold: 0.03,
        icon: <CalendarCheck className="h-4 w-4" />,
      },
      {
        label: `Gasto total (${showBRL ? "BRL" : "USD"})`,
        value: money(m.gasto_total_dolar, m.gasto_total_real),
        hint: `Custo/entregue: ${moneyVal(m.cpoEntregue)}`,
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: "Taxa de leitura",
        value: pctFmt(m.taxaLeituraBase),
        hint: `${numFmt(m.msg_lida)} de ${numFmt(m.msg_entregue)} entregues`,
        icon: <Eye className="h-4 w-4" />,
      },
      {
        label: "Taxa resposta",
        value: pctFmt(m.taxaResposta),
        hint: `${numFmt(m.msg_respondida)} de ${numFmt(m.msg_lida)} lidas`,
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        label: "Taxa agendamento",
        value: pctFmt(m.taxaAgendBase),
        pctVal: m.taxaAgendBase,
        hint: taxaAgendPct > 3 ? "✓ Acima de 3%" : "✕ Abaixo de 3%",
        threshold: 0.03,
        useValueColor: true,
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ];
  }, [metrics, showBRL, money, moneyVal]);

  // Funnel steps
  const funnelSteps = useMemo(() => {
    if (!metrics) return [];
    const d = metrics;
    return [
      { name: "Total da base", count: d.total_base, desc: "Total de leads no evento", key: "base" },
      {
        name: "Mensagem enviada",
        count: d.msg_enviada,
        desc: "Total de mensagens enviadas pelo WhatsApp",
        key: "enviada",
      },
      {
        name: "Mensagem entregue",
        count: d.msg_entregue,
        desc: "Mensagens efetivamente entregues ao destinatário",
        key: "entregue",
      },
      { name: "Mensagem lida", count: d.msg_lida, desc: "Mensagens lidas pelo destinatário", key: "lida" },
      { name: "Mensagem respondida", count: d.msg_respondida, desc: "Leads que responderam", key: "respondida" },
      { name: "Agendado", count: d.agendado, desc: "Leads que agendaram", key: "agendado" },
    ];
  }, [metrics]);

  // Losses
  const losses = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "Opt-out", count: metrics.optout, desc: "Leads que pediram para sair" },
      { name: "Negativa clara", count: metrics.negativa_clara, desc: "Objeção explícita" },
    ].filter((l) => l.count > 0);
  }, [metrics]);

  // No agent configured
  if (!agent && !loading) {
    return (
      <Card className="p-8 text-center">
        <Phone className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Nenhum Agente WhatsApp Configurado</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Configure um agente de IA com "WhatsApp" no nome e telefone válido para esta empresa.
        </p>
      </Card>
    );
  }

  if (loading && !dashboardData && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const leadBase = metrics?.total_base || 1;
  const sortedTemplates = metrics
    ? [...metrics.templates].sort((a, b) =>
        showBRL ? b.valor_em_real - a.valor_em_real : b.valor_em_dolar - a.valor_em_dolar,
      )
    : [];
  const totalTplSpent = sortedTemplates.reduce((sum, t) => sum + (showBRL ? t.valor_em_real : t.valor_em_dolar), 0);
  const maxTplSpent = sortedTemplates.length > 0 ? (showBRL ? sortedTemplates[0].valor_em_real : sortedTemplates[0].valor_em_dolar) : 1;
  const spentDiff = metrics ? metrics.gastoAtivo - totalTplSpent : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Dashboard PRI — WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            {agent && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {agent.nome} • {agent.telefone}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* USD/BRL Toggle */}
          <TooltipProvider>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/30">
              <span className={`text-xs font-bold ${!showBRL ? "text-primary" : "text-muted-foreground"}`}>USD</span>
              <Switch
                checked={showBRL}
                onCheckedChange={setShowBRL}
                className="data-[state=checked]:bg-primary"
              />
              <span className={`text-xs font-bold ${showBRL ? "text-primary" : "text-muted-foreground"}`}>BRL</span>
              {dashboardData?.rates_brl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      Cotação utilizada para conversão: 1 USD = R$ {Number(dashboardData.rates_brl).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                      {dashboardData.data_conversao && `, data: ${dashboardData.data_conversao}`}.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>

          {/* Multi-select Events Popover */}
          <Popover open={eventsPopoverOpen} onOpenChange={setEventsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[200px] justify-between"
                disabled={loadingEvents || events.length === 0}
              >
                <span className="truncate">
                  {loadingEvents
                    ? "Carregando..."
                    : selectedEventIds.length === 0
                      ? "Selecione eventos"
                      : selectedEventIds.length === 1
                        ? events.find((e) => e.id_evento === selectedEventIds[0])?.nome || "Evento"
                        : `${selectedEventIds.length} eventos selecionados`}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Eventos da PRI</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllEvents}>
                      Todos
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectNone}>
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-1">
                  {events.map((event) => {
                    const isSelected = selectedEventIds.includes(event.id_evento);
                    return (
                      <div
                        key={event.id_evento}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/10" : ""}`}
                        onClick={() => toggleEventSelection(event.id_evento)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.nome}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {event.empresa_nome && (
                              <>
                                <Store className="h-3 w-3" />
                                <span className="truncate">{event.empresa_nome}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>ID: {event.id_evento}</span>
                          </p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-3 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {selectedEventIds.length} de {events.length} evento(s) selecionado(s)
                </p>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading || selectedEventIds.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Atualizado em {lastUpdate.toLocaleString("pt-BR")}
            </Badge>
          )}
        </div>
      </div>

      {loading && !metrics && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {metrics && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpiCards.map((kpi, idx) => {
              let valueColor = "";
              if (kpi.useValueColor && kpi.threshold !== undefined) {
                const pv = kpi.pctVal ?? 0;
                valueColor = pv > kpi.threshold ? "text-emerald-500" : "text-destructive";
              }

              return (
                <div
                  key={idx}
                  className={`rounded-xl border border-border/40 bg-card shadow-sm border-l-[5px] ${kpi.borderColor} p-5`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {kpi.label}
                      </p>
                      <p className={`text-2xl font-bold ${valueColor}`}>{kpi.value}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {kpi.pctVal !== undefined && !kpi.useValueColor && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            kpi.threshold !== undefined
                              ? kpi.pctVal > kpi.threshold
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-destructive/15 text-destructive"
                              : kpi.badgeColor
                          }`}
                        >
                          {pctFmt(kpi.pctVal)}
                          {kpi.pctSuffix && <span className="ml-1 font-normal">{kpi.pctSuffix}</span>}
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground">{kpi.hint}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Funnel de Leads */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Funil de leads</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Base → Enviada → Entregue → Lida → Respondida → Agendado
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
                        <span className="font-extrabold text-sm">
                          {idx + 1}. {step.name}
                        </span>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-bold">
                          {numFmt(step.count)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Δ ant: {prevText}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {pctFmt(totalPct)} da base
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(2, width)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Losses */}
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
                      <Badge variant="outline" className="text-xs">
                        {numFmt(loss.count)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {pctFmt(safeDiv(loss.count, leadBase))} da base
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                Base {numFmt(metrics.total_base)} → Enviada {pctFmt(safeDiv(metrics.msg_enviada, metrics.total_base))} →
                Entregue {pctFmt(metrics.taxaEntrega)} → Lida {pctFmt(safeDiv(metrics.msg_lida, metrics.msg_entregue))}{" "}
                → Resposta {pctFmt(metrics.taxaResposta)} das lidas → Agendamento {pctFmt(metrics.taxaAgendResp)} (
                {pctFmt(metrics.taxaAgendBase)} da base).
              </p>
            </CardContent>
          </Card>

          {/* Gastos por Template */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Gastos por template ({showBRL ? "BRL" : "USD"})</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Detalhamento
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {sortedTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum template retornado pelo webhook.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-bold text-muted-foreground">Template</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Tipo de disparo</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Gasto</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">% do total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTemplates.map((t) => {
                        const tplVal = showBRL ? t.valor_em_real : t.valor_em_dolar;
                        const pctOfTotal = safeDiv(tplVal, totalTplSpent);
                        const barWidth = safeDiv(tplVal, maxTplSpent) * 100;
                        return (
                          <TableRow key={t.template_nome}>
                            <TableCell className="py-3">
                              <span className="text-sm font-bold text-amber-500">{t.template_nome}</span>
                              <div className="h-2 rounded-full bg-muted/50 overflow-hidden mt-2">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                                  style={{ width: `${Math.max(2, barWidth)}%` }}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm py-3">{t.tipo_disparo || "—"}</TableCell>
                            <TableCell className="text-sm py-3 text-right">{moneyVal(tplVal)}</TableCell>
                            <TableCell className="text-sm py-3 text-right">{pctFmt(pctOfTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell />
                        <TableCell className="font-bold text-right">{moneyVal(totalTplSpent)}</TableCell>
                        <TableCell className="font-bold text-right">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>

                  {Math.abs(spentDiff) > 0.02 && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Diferença entre gasto total ({moneyVal(metrics.gastoAtivo)}) e soma dos templates (
                      {moneyVal(totalTplSpent)}): {moneyVal(spentDiff)}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

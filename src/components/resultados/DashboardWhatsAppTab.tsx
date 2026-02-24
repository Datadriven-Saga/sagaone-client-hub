import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardWhatsAppTabProps {
  selectedEventId: string;
  selectedEventIdPri: string;
  onEventChange?: (eventId: string, eventIdPri: string) => void;
}

interface TemplateData {
  template_nome: string;
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
  gasto_total: string;
  templates: TemplateData[];
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
  gasto_total: number;
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
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = (n: number) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
const numFmt = (n: number) => n.toLocaleString('pt-BR');
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export const DashboardWhatsAppTab = ({ 
  selectedEventId,
  selectedEventIdPri,
  onEventChange 
}: DashboardWhatsAppTabProps) => {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [agent, setAgent] = useState<AgentWhatsApp | null>(null);
  const [eventsPopoverOpen, setEventsPopoverOpen] = useState(false);

  // Fetch WhatsApp agent for the company
  useEffect(() => {
    const fetchAgent = async () => {
      if (!activeCompany?.id) return;

      try {
        const { data: agenteEmpresasData, error } = await supabase
          .from('agente_empresas')
          .select('agente_id, agentes_ia!inner(id, nome, telefone, ativo)')
          .eq('empresa_id', activeCompany.id);
        
        if (error) {
          console.error('Error fetching agente_empresas:', error);
          return;
        }
        
        const allAgents = (agenteEmpresasData || [])
          .map((ae: any) => ae.agentes_ia)
          .filter((ag: any) => !!ag);

        const priWhatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || '').toLowerCase();
            const isWhatsApp = nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
            const isPri = nome.includes('pri');
            return isWhatsApp && isPri;
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));

        const whatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || '').toLowerCase();
            return nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));

        const chosen = priWhatsAppAgents[0] ?? whatsAppAgents[0];
        if (chosen) setAgent(chosen);
      } catch (error) {
        console.error('Error fetching WhatsApp agent:', error);
      }
    };

    fetchAgent();
  }, [activeCompany?.id]);

  // Fetch events when agent is available
  useEffect(() => {
    const fetchEvents = async () => {
      if (!agent?.telefone || !user?.id) {
        setEvents([]);
        return;
      }

      try {
        setLoadingEvents(true);
        
        const cleanPhone = agent.telefone.replace(/\D/g, '');
        
        const { data: userEmpresas, error: userEmpresasError } = await supabase
          .from('user_empresas')
          .select('empresa_id')
          .eq('user_id', user.id);

        if (userEmpresasError) {
          console.error('Erro ao buscar user_empresas:', userEmpresasError);
          return;
        }

        const empresaIds = userEmpresas?.map(ue => ue.empresa_id) || [];
        
        if (empresaIds.length === 0) {
          setEvents([]);
          return;
        }

        const { data: agentesEmpresas, error: agentesError } = await supabase
          .from('agente_empresas')
          .select('empresa_id, agentes_ia!inner(telefone, nome, ativo)')
          .in('empresa_id', empresaIds);

        if (agentesError) {
          console.error('Erro ao buscar agente_empresas:', agentesError);
        }

        const empresasComMesmoAgente = (agentesEmpresas || [])
          .filter((ae: any) => {
            const agentData = ae.agentes_ia;
            if (!agentData) return false;
            const nome = (agentData.nome || '').toLowerCase();
            const isWhatsApp = nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
            const telefoneAgente = (agentData.telefone || '').replace(/\D/g, '');
            return isWhatsApp && telefoneAgente === cleanPhone && agentData.ativo;
          })
          .map((ae: any) => ae.empresa_id);

        if (empresasComMesmoAgente.length === 0) {
          setEvents([]);
          return;
        }

        const { data: prospeccoes, error: prospError } = await supabase
          .from('prospeccoes')
          .select(`
            id, 
            titulo, 
            event_id_pri, 
            data_inicio, 
            data_fim,
            empresa_id,
            empresas!inner(nome_empresa)
          `)
          .eq('canal', 'Whatsapp')
          .not('event_id_pri', 'is', null)
          .in('empresa_id', empresasComMesmoAgente)
          .order('data_inicio', { ascending: false });

        if (prospError) {
          console.error('Erro ao buscar prospeccoes:', prospError);
          toast.error('Erro ao buscar eventos');
          return;
        }

        const eventsList: EventOption[] = (prospeccoes || []).map((p: any) => ({
          id_evento: Number(p.event_id_pri),
          nome: p.titulo || `Evento ${p.event_id_pri}`,
          empresa_nome: p.empresas?.nome_empresa || '',
          prospeccao_id: p.id,
        }));
        
        setEvents(eventsList);
        
        if (eventsList.length > 0 && selectedEventIds.length === 0) {
          setSelectedEventIds([eventsList[0].id_evento]);
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Erro ao carregar eventos');
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [agent?.telefone, user?.id]);

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
      
      console.log('📊 Fetching WhatsApp dashboard for events:', selectedEventIds);
      
      // Fetch and aggregate data for all selected events
      const allResponses = await Promise.all(
        selectedEventIds.map(async (eventId) => {
          const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
            body: { 
              endpoint: 'dashboard-evento-pri-whats', 
              id_evento: eventId
            },
          });
          
          if (error) {
            console.error(`Error fetching event ${eventId}:`, error);
            return null;
          }
          
          // Response can be an array or a single object
          if (Array.isArray(data)) {
            return data[0] as WebhookResponse | undefined;
          }
          if (data && typeof data === 'object' && 'total_base' in data) {
            return data as WebhookResponse;
          }
          console.warn(`Unexpected response format for event ${eventId}:`, data);
          return null;
        })
      );

      // Aggregate all responses
      const aggregated: DashboardData = {
        total_base: 0,
        msg_enviada: 0,
        msg_entregue: 0,
        msg_lida: 0,
        msg_respondida: 0,
        agendado: 0,
        optout: 0,
        negativa_clara: 0,
        gasto_total: 0,
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
        aggregated.gasto_total += Number(resp.gasto_total) || 0;

        (resp.templates || []).forEach((t) => {
          const key = t.template_nome;
          const existing = templateMap.get(key);
          if (existing) {
            existing.valor_em_real += Number(t.valor_em_real) || 0;
          } else {
            templateMap.set(key, { 
              template_nome: t.template_nome, 
              valor_em_real: Number(t.valor_em_real) || 0, 
              tipo_disparo: t.tipo_disparo 
            });
          }
        });
      });

      aggregated.templates = Array.from(templateMap.values());

      console.log('📊 Dashboard WhatsApp aggregated:', aggregated);
      
      setDashboardData(aggregated);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedEventIds]);

  const toggleEventSelection = (eventId: number) => {
    setSelectedEventIds(prev => {
      if (prev.includes(eventId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== eventId);
      }
      return [...prev, eventId];
    });
  };

  const selectAllEvents = () => {
    setSelectedEventIds(events.map(e => e.id_evento));
  };

  const selectNone = () => {
    if (events.length > 0) {
      setSelectedEventIds([events[0].id_evento]);
    }
  };

  // Computed metrics
  const metrics = useMemo(() => {
    if (!dashboardData) return null;
    const d = dashboardData;

    const taxaEntrega = safeDiv(d.msg_entregue, d.msg_enviada);
    const taxaResposta = safeDiv(d.msg_respondida, d.msg_entregue);
    const taxaAgendBase = safeDiv(d.agendado, d.total_base);
    const taxaAgendResp = safeDiv(d.agendado, d.msg_respondida);

    const cpoEntregue = safeDiv(d.gasto_total, d.msg_entregue);
    const cpoRespondido = safeDiv(d.gasto_total, d.msg_respondida);
    const cpoAgendado = safeDiv(d.gasto_total, d.agendado);

    return {
      ...d,
      taxaEntrega,
      taxaResposta,
      taxaAgendBase,
      taxaAgendResp,
      cpoEntregue,
      cpoRespondido,
      cpoAgendado,
    };
  }, [dashboardData]);

  // KPI cards
  const kpiCards = useMemo(() => {
    if (!metrics) return [];
    const m = metrics;
    const taxaAgendPct = m.taxaAgendBase * 100;

    return [
      { label: 'Total da base', value: numFmt(m.total_base), hint: `Enviadas: ${pctFmt(safeDiv(m.msg_enviada, m.total_base))}`, icon: <MessageSquare className="h-4 w-4" /> },
      { label: 'Msg entregues', value: numFmt(m.msg_entregue), pctVal: m.taxaEntrega, hint: `Custo/entregue: ${brl(m.cpoEntregue)}`, icon: <CheckCircle2 className="h-4 w-4" /> },
      { label: 'Leads responderam', value: numFmt(m.msg_respondida), pctVal: m.taxaResposta, hint: `Custo/respondido: ${brl(m.cpoRespondido)}`, icon: <MessageCircle className="h-4 w-4" /> },
      { label: 'Leads agendados', value: numFmt(m.agendado), pctVal: m.taxaAgendBase, hint: `CPL agendado: ${brl(m.cpoAgendado)}`, threshold: 0.03, icon: <CalendarCheck className="h-4 w-4" /> },
      { label: 'Gasto total', value: brl(m.gasto_total), hint: `Custo/entregue: ${brl(m.cpoEntregue)}`, icon: <DollarSign className="h-4 w-4" /> },
      { label: 'Taxa entrega', value: pctFmt(m.taxaEntrega), hint: `${numFmt(m.msg_entregue)} de ${numFmt(m.msg_enviada)} enviadas`, icon: <Send className="h-4 w-4" /> },
      { label: 'Taxa resposta', value: pctFmt(m.taxaResposta), hint: `${numFmt(m.msg_respondida)} de ${numFmt(m.msg_entregue)} entregues`, icon: <TrendingUp className="h-4 w-4" /> },
      { label: 'Taxa agendamento', value: pctFmt(m.taxaAgendBase), hint: taxaAgendPct > 3 ? '✓ Acima de 3%' : '✕ Abaixo de 3%', threshold: 0.03, useValueColor: true, icon: <BarChart3 className="h-4 w-4" /> },
    ];
  }, [metrics]);

  // Funnel steps
  const funnelSteps = useMemo(() => {
    if (!metrics) return [];
    const d = metrics;
    return [
      { name: 'Total da base', count: d.total_base, desc: 'Total de leads no evento', key: 'base' },
      { name: 'Msg enviada', count: d.msg_enviada, desc: 'Leads que receberam pelo menos uma mensagem', key: 'enviada' },
      { name: 'Msg entregue', count: d.msg_entregue, desc: 'Mensagens efetivamente entregues ao destinatário', key: 'entregue' },
      { name: 'Msg lida', count: d.msg_lida, desc: 'Mensagens lidas pelo destinatário', key: 'lida' },
      { name: 'Msg respondida', count: d.msg_respondida, desc: 'Leads que responderam', key: 'respondida' },
      { name: 'Agendado', count: d.agendado, desc: 'Leads que agendaram', key: 'agendado' },
    ];
  }, [metrics]);

  // Losses
  const losses = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Opt-out', count: metrics.optout, desc: 'Leads que pediram para sair' },
      { name: 'Negativa clara', count: metrics.negativa_clara, desc: 'Objeção explícita' },
    ].filter(l => l.count > 0);
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
  const sortedTemplates = metrics ? [...metrics.templates].sort((a, b) => b.valor_em_real - a.valor_em_real) : [];
  const totalTplSpent = sortedTemplates.reduce((sum, t) => sum + t.valor_em_real, 0);
  const maxTplSpent = sortedTemplates.length > 0 ? sortedTemplates[0].valor_em_real : 1;
  const spentDiff = metrics ? metrics.gasto_total - totalTplSpent : 0;

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
                    ? 'Carregando...' 
                    : selectedEventIds.length === 0 
                      ? 'Selecione eventos'
                      : selectedEventIds.length === 1
                        ? events.find(e => e.id_evento === selectedEventIds[0])?.nome || 'Evento'
                        : `${selectedEventIds.length} eventos selecionados`
                  }
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Eventos da PRI</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllEvents}>Todos</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectNone}>Limpar</Button>
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
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/10' : ''}`}
                        onClick={() => toggleEventSelection(event.id_evento)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleEventSelection(event.id_evento)} />
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
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Atualizado em {lastUpdate.toLocaleString('pt-BR')}
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
              let valueColor = '';
              if (kpi.useValueColor && kpi.threshold !== undefined) {
                const pv = kpi.pctVal ?? 0;
                valueColor = pv > kpi.threshold ? 'text-emerald-500' : 'text-destructive';
              }

              return (
                <Card key={idx} className="bg-gradient-to-b from-card/80 to-card border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      {kpi.icon}
                      <span className="text-xs font-medium">{kpi.label}</span>
                    </div>
                    <p className={`text-xl font-extrabold ${valueColor}`}>{kpi.value}</p>
                    {kpi.pctVal !== undefined && !kpi.useValueColor && (
                      <p className={`text-sm font-bold mt-1 ${
                        kpi.threshold !== undefined
                          ? (kpi.pctVal > kpi.threshold ? 'text-emerald-500' : 'text-destructive')
                          : 'text-muted-foreground'
                      }`}>
                        {pctFmt(kpi.pctVal)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
                  </CardContent>
                </Card>
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
                const prevText = prev === null ? '—' : pctFmt(safeDiv(step.count, prev));
                const totalPct = safeDiv(step.count, leadBase);

                // Special styling for "agendado"
                const isAgendado = step.key === 'agendado';
                const isGood = isAgendado && totalPct > 0.03;
                const isBad = isAgendado && totalPct <= 0.03;

                let borderClass = 'border-border/50';
                let bgClass = 'bg-background/30';
                if (isGood) { borderClass = 'border-emerald-500/40'; bgClass = 'bg-emerald-500/5'; }
                if (isBad) { borderClass = 'border-destructive/40'; bgClass = 'bg-destructive/5'; }

                return (
                  <div key={step.key} className={`border rounded-xl p-3 ${borderClass} ${bgClass}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-extrabold text-sm">{idx + 1}. {step.name}</span>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs font-bold ${isGood ? 'border-emerald-500/40 text-emerald-500' : isBad ? 'border-destructive/40 text-destructive' : ''}`}>
                          {numFmt(step.count)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Δ ant: {prevText}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${isGood ? 'border-emerald-500/40 text-emerald-500' : isBad ? 'border-destructive/40 text-destructive' : ''}`}>
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
                      <Badge variant="outline" className="text-xs">{numFmt(loss.count)}</Badge>
                      <Badge variant="outline" className="text-xs">{pctFmt(safeDiv(loss.count, leadBase))} da base</Badge>
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                Base {numFmt(metrics.total_base)} → 
                Enviada {pctFmt(safeDiv(metrics.msg_enviada, metrics.total_base))} → 
                Entregue {pctFmt(metrics.taxaEntrega)} → 
                Lida {pctFmt(safeDiv(metrics.msg_lida, metrics.msg_entregue))} → 
                Resposta {pctFmt(metrics.taxaResposta)} → 
                Agendamento {pctFmt(metrics.taxaAgendResp)} ({pctFmt(metrics.taxaAgendBase)} da base).
              </p>
            </CardContent>
          </Card>

          {/* Gastos por Template */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Gastos por template</CardTitle>
                <Badge variant="outline" className="text-xs">Detalhamento</Badge>
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
                        const pctOfTotal = safeDiv(t.valor_em_real, totalTplSpent);
                        const barWidth = safeDiv(t.valor_em_real, maxTplSpent) * 100;
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
                            <TableCell className="text-sm py-3">{t.tipo_disparo || '—'}</TableCell>
                            <TableCell className="text-sm py-3 text-right">{brl(t.valor_em_real)}</TableCell>
                            <TableCell className="text-sm py-3 text-right">{pctFmt(pctOfTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell />
                        <TableCell className="font-bold text-right">{brl(totalTplSpent)}</TableCell>
                        <TableCell className="font-bold text-right">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>

                  {Math.abs(spentDiff) > 0.02 && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Diferença entre gasto total ({brl(metrics.gasto_total)}) e soma dos templates ({brl(totalTplSpent)}): {brl(spentDiff)}
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

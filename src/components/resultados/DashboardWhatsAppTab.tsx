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
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface DashboardWhatsAppTabProps {
  selectedEventId: string;
  selectedEventIdPri: string;
  onEventChange?: (eventId: string, eventIdPri: string) => void;
}

interface FunnelStatus {
  status: string;
  total: string;
}

interface EventOption {
  id_evento: number;
  nome: string;
  selected?: boolean;
}

interface AgentWhatsApp {
  id: string;
  nome: string;
  telefone: string;
}

interface ManualInputs {
  msg_entregue: number;
  msg_lida: number;
  valor_usado: number;
}

// Helper functions
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export const DashboardWhatsAppTab = ({ 
  selectedEventId,
  selectedEventIdPri,
  onEventChange 
}: DashboardWhatsAppTabProps) => {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [funnelData, setFunnelData] = useState<FunnelStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [agent, setAgent] = useState<AgentWhatsApp | null>(null);
  const [eventsPopoverOpen, setEventsPopoverOpen] = useState(false);
  
  // Manual inputs (to be implemented with Meta API later)
  const [manualInputs, setManualInputs] = useState<ManualInputs>({
    msg_entregue: 0,
    msg_lida: 0,
    valor_usado: 0,
  });

  // Fetch WhatsApp agent for the company
  useEffect(() => {
    const fetchAgent = async () => {
      if (!activeCompany?.id) return;

      try {
        // Get agents linked to this company via agente_empresas, filtering by nome containing "WhatsApp" or "Whatsapp"
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

        // Prefer the explicit "Pri WhatsApp" agent for this store.
        // This avoids picking the wrong WhatsApp agent when multiple are linked.
        const priWhatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || '').toLowerCase();
            const isWhatsApp = nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
            const isPri = nome.includes('pri');
            return isWhatsApp && isPri;
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));

        // Fallback: any WhatsApp agent (legacy behavior)
        const whatsAppAgents = allAgents
          .filter((ag: any) => {
            if (!ag.ativo || !ag.telefone) return false;
            const nome = (ag.nome || '').toLowerCase();
            return nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
          })
          .map((ag: any) => ({ id: ag.id, nome: ag.nome, telefone: ag.telefone }));
        
        console.log('📱 Agentes Pri WhatsApp encontrados:', priWhatsAppAgents);
        console.log('📱 Agentes WhatsApp encontrados (fallback):', whatsAppAgents);

        const chosen = priWhatsAppAgents[0] ?? whatsAppAgents[0];
        if (chosen) setAgent(chosen);
      } catch (error) {
        console.error('Error fetching WhatsApp agent:', error);
      }
    };

    fetchAgent();
  }, [activeCompany?.id]);

  // Fetch events from local eventos_pri_voz table - filter by telefone_pri_whatsapp matching agent phone
  useEffect(() => {
    const fetchEvents = async () => {
      if (!agent?.telefone) {
        setEvents([]);
        return;
      }

      try {
        setLoadingEvents(true);
        
        // Clean phone number (remove non-digits)
        const cleanPhone = agent.telefone.replace(/\D/g, '');
        
        console.log('📊 Buscando eventos WhatsApp no Supabase para telefone_pri:', cleanPhone);
        
        // Query eventos_pri_voz filtering by telefone_pri_whatsapp OR telefone_pri
        const { data, error } = await supabase
          .from('eventos_pri_voz')
          .select('id_evento, nome, telefone_pri, telefone_pri_whatsapp, evt_status')
          .or(`telefone_pri_whatsapp.eq.${cleanPhone},telefone_pri.eq.${cleanPhone}`)
          .order('id_evento', { ascending: false });

        if (error) {
          console.error('Error fetching events from Supabase:', error);
          toast.error('Erro ao buscar eventos');
          return;
        }

        console.log('📱 Eventos WhatsApp encontrados:', data);
        
        // Map to EventOption format
        const eventsList: EventOption[] = (data || [])
          .filter((evt) => evt.id_evento && evt.id_evento > 0)
          .map((evt) => ({
            id_evento: evt.id_evento,
            nome: evt.nome || `Evento ${evt.id_evento}`,
          }));
        
        setEvents(eventsList);
        
        // Auto-select first event if none selected
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
  }, [agent?.telefone]);

  // Fetch dashboard data when selected events change
  useEffect(() => {
    if (selectedEventIds.length > 0) {
      fetchDashboardData();
    } else {
      setFunnelData([]);
    }
  }, [selectedEventIds]);

  const fetchDashboardData = useCallback(async () => {
    if (selectedEventIds.length === 0) return;

    try {
      setLoading(true);
      
      console.log('📊 Fetching WhatsApp dashboard for events:', selectedEventIds);
      
      // Fetch data for all selected events and aggregate
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
            return [];
          }
          
          return Array.isArray(data) ? data : [];
        })
      );

      // Aggregate all responses
      const aggregated: Record<string, number> = {};
      
      allResponses.forEach((response) => {
        response.forEach((item: FunnelStatus) => {
          const status = item.status;
          const total = parseInt(item.total || '0', 10);
          aggregated[status] = (aggregated[status] || 0) + total;
        });
      });
      
      // Convert back to array format
      const statusData: FunnelStatus[] = Object.entries(aggregated).map(([status, total]) => ({
        status,
        total: total.toString(),
      }));

      console.log('📊 Dashboard WhatsApp aggregated:', statusData);
      
      setFunnelData(statusData);
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
        // Don't allow deselecting if it's the only one
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

  // Get totals from API data
  const getTotal = (status: string) => {
    const item = funnelData.find(d => d.status === status);
    return parseInt(item?.total || '0', 10);
  };

  // Calculate all metrics
  const metrics = useMemo(() => {
    const msg_enviada = getTotal('msg_enviada');
    const msg_respondida = getTotal('msg_respondida');
    const agendado = getTotal('agendado');
    const negativa_clara = getTotal('negativa_clara');
    const novo = getTotal('novo');
    const confirmado = getTotal('confirmado');

    // Use manual inputs for delivered, read, and spend
    const { msg_entregue, msg_lida, valor_usado } = manualInputs;

    // Rates
    const deliveryRate = safeDiv(msg_entregue, msg_enviada);
    const readRateDelivered = safeDiv(msg_lida, msg_entregue);
    const responseRateDelivered = safeDiv(msg_respondida, msg_entregue);
    const responseRateRead = safeDiv(msg_respondida, msg_lida);
    const scheduleRateResponded = safeDiv(agendado, msg_respondida);
    const scheduleRateDelivered = safeDiv(agendado, msg_entregue);

    // Costs per stage
    const cpoSent = safeDiv(valor_usado, msg_enviada);
    const cpoDelivered = safeDiv(valor_usado, msg_entregue);
    const cpoRead = safeDiv(valor_usado, msg_lida);
    const cpoResponded = safeDiv(valor_usado, msg_respondida);
    const cpoScheduled = safeDiv(valor_usado, agendado);

    return {
      msg_enviada,
      msg_entregue,
      msg_lida,
      msg_respondida,
      agendado,
      negativa_clara,
      novo,
      confirmado,
      valor_usado,
      deliveryRate,
      readRateDelivered,
      responseRateDelivered,
      responseRateRead,
      scheduleRateResponded,
      scheduleRateDelivered,
      cpoSent,
      cpoDelivered,
      cpoRead,
      cpoResponded,
      cpoScheduled,
    };
  }, [funnelData, manualInputs]);

  // Funnel steps for visualization
  const funnelSteps = useMemo(() => {
    const { msg_enviada, msg_entregue, msg_lida, msg_respondida, agendado } = metrics;
    const base = msg_enviada || 1;

    return [
      { 
        name: 'Enviadas', 
        count: msg_enviada, 
        ratePrev: null,
        totalRate: safeDiv(msg_enviada, base)
      },
      { 
        name: 'Entregues', 
        count: msg_entregue, 
        ratePrev: safeDiv(msg_entregue, msg_enviada),
        totalRate: safeDiv(msg_entregue, base)
      },
      { 
        name: 'Lidas', 
        count: msg_lida, 
        ratePrev: safeDiv(msg_lida, msg_entregue),
        totalRate: safeDiv(msg_lida, base)
      },
      { 
        name: 'Respondidas', 
        count: msg_respondida, 
        ratePrev: msg_lida > 0 ? safeDiv(msg_respondida, msg_lida) : safeDiv(msg_respondida, msg_entregue),
        totalRate: safeDiv(msg_respondida, base)
      },
      { 
        name: 'Agendadas', 
        count: agendado, 
        ratePrev: safeDiv(agendado, msg_respondida),
        totalRate: safeDiv(agendado, base)
      },
    ];
  }, [metrics]);

  // Details table rows
  const detailsRows = useMemo(() => {
    const m = metrics;
    return [
      ['Custo por enviada', brl(m.cpoSent)],
      ['Custo por entregue', m.msg_entregue > 0 ? brl(m.cpoDelivered) : '—'],
      ['Custo por lida', m.msg_lida > 0 ? brl(m.cpoRead) : '—'],
      ['Custo por respondida', brl(m.cpoResponded)],
      ['Custo por lead agendado (CPL)', brl(m.cpoScheduled)],
      ['Taxa de entrega', pct(m.deliveryRate)],
      ['Taxa de leitura (entregues)', pct(m.readRateDelivered)],
      ['Taxa de resposta (entregues)', pct(m.responseRateDelivered)],
      ['Taxa de resposta (lidas)', m.msg_lida > 0 ? pct(m.responseRateRead) : '—'],
      ['Taxa de agendamento (respondidas)', pct(m.scheduleRateResponded)],
      ['Agendamento (entregues)', pct(m.scheduleRateDelivered)],
      ['Negativa clara', m.negativa_clara.toLocaleString('pt-BR')],
    ];
  }, [metrics]);

  // KPI cards data
  const kpiCards = useMemo(() => {
    const m = metrics;
    return [
      { 
        label: 'Mensagens enviadas', 
        value: m.msg_enviada.toLocaleString('pt-BR'), 
        hint: `Custo/envio: ${brl(m.cpoSent)}`,
        icon: <Send className="h-4 w-4" />
      },
      { 
        label: 'Mensagens entregues', 
        value: m.msg_entregue.toLocaleString('pt-BR'), 
        hint: `Entrega: ${pct(m.deliveryRate)} | Custo: ${brl(m.cpoDelivered)}`,
        icon: <CheckCircle2 className="h-4 w-4" />
      },
      { 
        label: 'Mensagens lidas', 
        value: m.msg_lida.toLocaleString('pt-BR'), 
        hint: `Leitura (entregues): ${pct(m.readRateDelivered)}${m.msg_lida > 0 ? ` | Custo: ${brl(m.cpoRead)}` : ''}`,
        icon: <Eye className="h-4 w-4" />
      },
      { 
        label: 'Mensagens respondidas', 
        value: m.msg_respondida.toLocaleString('pt-BR'), 
        hint: `Resposta (entregues): ${pct(m.responseRateDelivered)} | Custo: ${brl(m.cpoResponded)}`,
        icon: <MessageCircle className="h-4 w-4" />
      },
      { 
        label: 'Leads agendados', 
        value: m.agendado.toLocaleString('pt-BR'), 
        hint: `CPL (Agendado): ${brl(m.cpoScheduled)}`,
        icon: <CalendarCheck className="h-4 w-4" />
      },
      { 
        label: 'Negativa clara', 
        value: m.negativa_clara.toLocaleString('pt-BR'), 
        hint: 'Objeção explícita',
        icon: <XCircle className="h-4 w-4" />
      },
      { 
        label: 'Valor usado', 
        value: brl(m.valor_usado), 
        hint: 'Investimento total',
        icon: <DollarSign className="h-4 w-4" />
      },
      { 
        label: 'Agendamento (entregues)', 
        value: pct(m.scheduleRateDelivered), 
        hint: `Agendamento (respondidas): ${pct(m.scheduleRateResponded)}`,
        icon: <TrendingUp className="h-4 w-4" />
      },
    ];
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

  if (loading && funnelData.length === 0 && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Dashboard PRI WhatsApp
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
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={selectAllEvents}
                    >
                      Todos
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={selectNone}
                    >
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
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleEventSelection(event.id_evento)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleEventSelection(event.id_evento)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.nome}</p>
                          <p className="text-xs text-muted-foreground">ID: {event.id_evento}</p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    );
                  })}
                  {events.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum evento encontrado para esta PRI
                    </p>
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {selectedEventIds.length} de {events.length} evento(s) selecionado(s)
                </p>
              </div>
            </PopoverContent>
          </Popover>

          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {lastUpdate.toLocaleString('pt-BR')}
            </Badge>
          )}
        </div>
      </div>

      {/* Manual Input Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Entrada de dados (manual)
            </CardTitle>
            <Badge variant="outline" className="text-xs">Preencha e atualize</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="msg_entregue" className="text-xs text-muted-foreground">
                Mensagens entregues
              </Label>
              <Input 
                id="msg_entregue"
                type="number" 
                min="0" 
                value={manualInputs.msg_entregue}
                onChange={(e) => setManualInputs(prev => ({ ...prev, msg_entregue: Number(e.target.value) || 0 }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg_lida" className="text-xs text-muted-foreground">
                Mensagens lidas
              </Label>
              <Input 
                id="msg_lida"
                type="number" 
                min="0" 
                value={manualInputs.msg_lida}
                onChange={(e) => setManualInputs(prev => ({ ...prev, msg_lida: Number(e.target.value) || 0 }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_usado" className="text-xs text-muted-foreground">
                Valor usado (R$)
              </Label>
              <Input 
                id="valor_usado"
                type="number" 
                min="0" 
                step="0.01"
                value={manualInputs.valor_usado}
                onChange={(e) => setManualInputs(prev => ({ ...prev, valor_usado: Number(e.target.value) || 0 }))}
                className="bg-background/50"
              />
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={fetchDashboardData}
                disabled={loading || selectedEventIds.length === 0}
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Observação: "Lidas" é opcional. Se você não tiver esse número, deixe 0.
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpiCards.map((kpi, idx) => (
          <Card key={idx} className="bg-gradient-to-b from-card/80 to-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {kpi.icon}
                <span className="text-xs font-medium">{kpi.label}</span>
              </div>
              <p className="text-xl font-extrabold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel and Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">Funil de conversão</CardTitle>
              <Badge variant="outline" className="text-xs">
                Sent → Delivered → Read → Responded → Scheduled
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnelSteps.map((step, idx) => {
              const base = funnelSteps[0].count || 1;
              const width = Math.max(2, safeDiv(step.count, base) * 100);
              const prevText = idx === 0 ? '—' : pct(step.ratePrev ?? 0);

              return (
                <div 
                  key={idx} 
                  className="border border-border/50 rounded-xl p-3 bg-background/30"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-extrabold text-sm">{idx + 1}. {step.name}</span>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {step.count.toLocaleString('pt-BR')}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Δ prev: {prevText}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Total: {pct(step.totalRate)}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden mt-2">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-muted-foreground leading-relaxed mt-4">
              Entrega {pct(metrics.deliveryRate)} → Leitura (sobre entregues) {pct(metrics.readRateDelivered)} → {' '}
              {metrics.msg_lida > 0 
                ? `Resposta (sobre lidas) ${pct(metrics.responseRateRead)}` 
                : `Resposta (sobre entregues) ${pct(metrics.responseRateDelivered)}`} → {' '}
              Agendamento (sobre respondidas) {pct(metrics.scheduleRateResponded)}. {' '}
              CPL (Agendado): {brl(metrics.cpoScheduled)}.
            </p>
          </CardContent>
        </Card>

        {/* Details Table Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">Detalhes e custos</CardTitle>
              <Badge variant="outline" className="text-xs">R$ por etapa</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold text-muted-foreground">Métrica</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailsRows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm py-2.5">{row[0]}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right">{row[1]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-4">
              * "Negativa clara" não entra no funil principal, mas fica aqui para acompanhamento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

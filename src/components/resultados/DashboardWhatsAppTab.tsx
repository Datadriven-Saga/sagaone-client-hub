import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  RefreshCw, 
  MessageSquare, 
  Send, 
  MessageCircle,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  DollarSign,
  Eye,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

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
  id: string;
  titulo: string;
  event_id_pri: string | null;
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
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<FunnelStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  
  // Manual inputs (to be implemented with Meta API later)
  const [manualInputs, setManualInputs] = useState<ManualInputs>({
    msg_entregue: 0,
    msg_lida: 0,
    valor_usado: 0,
  });

  // Fetch events with event_id_pri from prospeccoes (for dropdown)
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, event_id_pri')
        .eq('canal', 'Whatsapp')
        .not('event_id_pri', 'is', null)
        .order('data_inicio', { ascending: false });

      if (!error && data) {
        setEvents(data as EventOption[]);
      }
    };

    fetchEvents();
  }, []);

  // Fetch dashboard data when selectedEventIdPri changes
  useEffect(() => {
    if (selectedEventIdPri) {
      fetchDashboardData();
    }
  }, [selectedEventIdPri]);

  const fetchDashboardData = async () => {
    if (!selectedEventIdPri) return;

    try {
      setLoading(true);
      
      console.log('📊 Fetching WhatsApp dashboard for event_id_pri:', selectedEventIdPri);
      
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { 
          endpoint: 'dashboard-evento-pri-whats', 
          id_evento: selectedEventIdPri 
        },
      });

      if (error) {
        throw new Error('Erro ao buscar dados do dashboard');
      }

      console.log('📊 Dashboard WhatsApp response:', data);
      
      // Data comes as array of status objects
      const statusData = Array.isArray(data) ? data : [];
      setFunnelData(statusData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event?.event_id_pri) {
      onEventChange?.(eventId, event.event_id_pri);
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

  if (loading && funnelData.length === 0) {
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
            Dashboard PRI — Evento
          </h2>
          <p className="text-sm text-muted-foreground">
            Insira os números e acompanhe os resultados do evento
          </p>
        </div>

        <div className="flex items-center gap-3">
          {events.length > 1 && (
            <Select value={selectedEventId} onValueChange={handleEventChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Atualizado em {lastUpdate.toLocaleString('pt-BR')}
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
                disabled={loading}
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar dashboard
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

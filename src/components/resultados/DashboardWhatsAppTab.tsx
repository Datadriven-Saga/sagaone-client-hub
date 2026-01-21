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
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SalesFunnel } from '@/components/SalesFunnel';

interface DashboardWhatsAppTabProps {
  selectedEventId: string;
  onEventChange?: (eventId: string) => void;
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

// Map status to funnel stages with colors
const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; order: number }> = {
  'novo': { label: 'Novos', color: '#3b82f6', icon: <Users className="h-4 w-4" />, order: 1 },
  'msg_enviada': { label: 'Mensagem Enviada', color: '#8b5cf6', icon: <Send className="h-4 w-4" />, order: 2 },
  'msg_respondida': { label: 'Mensagem Respondida', color: '#f59e0b', icon: <MessageCircle className="h-4 w-4" />, order: 3 },
  'agendado': { label: 'Agendados', color: '#10b981', icon: <CalendarCheck className="h-4 w-4" />, order: 4 },
  'confirmado': { label: 'Confirmados', color: '#22c55e', icon: <CheckCircle2 className="h-4 w-4" />, order: 5 },
  'negativa_clara': { label: 'Negativa Clara', color: '#ef4444', icon: <XCircle className="h-4 w-4" />, order: 6 },
};

export const DashboardWhatsAppTab = ({ 
  selectedEventId,
  onEventChange 
}: DashboardWhatsAppTabProps) => {
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<FunnelStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [currentEventIdPri, setCurrentEventIdPri] = useState<string | null>(null);

  // Fetch events with event_id_pri from prospeccoes
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, event_id_pri')
        .eq('canal', 'IA Whatsapp')
        .not('event_id_pri', 'is', null)
        .order('data_inicio', { ascending: false });

      if (!error && data) {
        setEvents(data as EventOption[]);
        
        // Set current event's event_id_pri
        const currentEvent = data.find(e => e.id === selectedEventId);
        if (currentEvent?.event_id_pri) {
          setCurrentEventIdPri(currentEvent.event_id_pri);
        }
      }
    };

    fetchEvents();
  }, [selectedEventId]);

  // Fetch dashboard data when event_id_pri changes
  useEffect(() => {
    if (currentEventIdPri) {
      fetchDashboardData();
    }
  }, [currentEventIdPri]);

  const fetchDashboardData = async () => {
    if (!currentEventIdPri) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { 
          endpoint: 'dashboard-evento-pri-whats', 
          id_evento: currentEventIdPri 
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
      setCurrentEventIdPri(event.event_id_pri);
      onEventChange?.(eventId);
    }
  };

  // Sort and transform funnel data
  const funnelStages = useMemo(() => {
    return funnelData
      .filter(item => statusConfig[item.status])
      .sort((a, b) => {
        const orderA = statusConfig[a.status]?.order ?? 999;
        const orderB = statusConfig[b.status]?.order ?? 999;
        return orderA - orderB;
      })
      .map(item => ({
        id: item.status,
        title: statusConfig[item.status]?.label || item.status,
        value: parseInt(item.total, 10) || 0,
        color: statusConfig[item.status]?.color || '#6b7280',
      }));
  }, [funnelData]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const getTotal = (status: string) => {
      const item = funnelData.find(d => d.status === status);
      return parseInt(item?.total || '0', 10);
    };

    const total = funnelData.reduce((sum, item) => sum + parseInt(item.total, 10), 0);
    const novos = getTotal('novo');
    const enviadas = getTotal('msg_enviada');
    const respondidas = getTotal('msg_respondida');
    const agendados = getTotal('agendado');
    const confirmados = getTotal('confirmado');
    const negativos = getTotal('negativa_clara');

    return {
      total,
      novos,
      enviadas,
      respondidas,
      agendados,
      confirmados,
      negativos,
      taxaResposta: enviadas > 0 ? ((respondidas / enviadas) * 100).toFixed(1) : '0',
      taxaAgendamento: respondidas > 0 ? ((agendados / respondidas) * 100).toFixed(1) : '0',
      taxaConfirmacao: agendados > 0 ? ((confirmados / agendados) * 100).toFixed(1) : '0',
    };
  }, [funnelData]);

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
            Dashboard WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhamento do funil de mensagens do evento
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

          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold">{metrics.total.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium">Enviadas</span>
            </div>
            <p className="text-2xl font-bold">{metrics.enviadas.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Respondidas</span>
            </div>
            <p className="text-2xl font-bold">{metrics.respondidas.toLocaleString()}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {metrics.taxaResposta}% taxa
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CalendarCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Agendados</span>
            </div>
            <p className="text-2xl font-bold">{metrics.agendados.toLocaleString()}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {metrics.taxaAgendamento}% taxa
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Confirmados</span>
            </div>
            <p className="text-2xl font-bold">{metrics.confirmados.toLocaleString()}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {metrics.taxaConfirmacao}% taxa
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Negativos</span>
            </div>
            <p className="text-2xl font-bold">{metrics.negativos.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel */}
      {funnelStages.length > 0 && (
        <SalesFunnel 
          stages={funnelStages} 
          title="Funil de Conversão WhatsApp" 
        />
      )}

      {/* Conversion Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Conversões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">{metrics.taxaResposta}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Resposta</p>
              <p className="text-xs text-muted-foreground">
                {metrics.respondidas} de {metrics.enviadas} mensagens
              </p>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-emerald-500">{metrics.taxaAgendamento}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Agendamento</p>
              <p className="text-xs text-muted-foreground">
                {metrics.agendados} de {metrics.respondidas} respondidas
              </p>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-green-500">{metrics.taxaConfirmacao}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Confirmação</p>
              <p className="text-xs text-muted-foreground">
                {metrics.confirmados} de {metrics.agendados} agendados
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

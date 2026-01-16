import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Phone, PhoneCall, PhoneOff, CalendarCheck, MessageSquare, TrendingUp, 
  Filter, X, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MetricasLigacaoTabProps {
  selectedAgentPhone: string | null;
}

interface EventData {
  id: string;
  nome: string;
  telefone_pri?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  marca?: string;
}

interface LeadData {
  id?: string;
  nome?: string;
  telefone_lead?: string;
  telefone_pri?: string;
  loja?: string;
  marca?: string;
  estado?: string;
  uf?: string;
  cidade?: string;
  evento_id?: string;
  evento_nome?: string;
  atendido?: boolean;
  agendado?: boolean;
  erro?: boolean;
  whatsapp_enviado?: boolean;
}

interface EventMetrics {
  eventId: string;
  eventName: string;
  marca?: string;
  estado?: string;
  cidade?: string;
  telefone_pri?: string;
  leads: LeadData[];
  metricas: {
    totalLeads: number;
    leadsAtendidos: number;
    leadsEmFila: number;
    leadsAgendados: number;
    mensagensEnviadas: number;
  };
}

interface Filters {
  telefone_pri: string;
  evento: string;
  showOnlyAtendidos: boolean;
  showOnlyAgendados: boolean;
  showOnlyEmFila: boolean;
  showOnlyWhatsapp: boolean;
}

export const MetricasLigacaoTab = ({ selectedAgentPhone }: MetricasLigacaoTabProps) => {
  const [allEventsData, setAllEventsData] = useState<EventMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [lastAppUpdate, setLastAppUpdate] = useState('');
  const [filters, setFilters] = useState<Filters>({
    telefone_pri: '',
    evento: '',
    showOnlyAtendidos: false,
    showOnlyAgendados: false,
    showOnlyEmFila: false,
    showOnlyWhatsapp: false,
  });

  useEffect(() => {
    if (selectedAgentPhone) {
      fetchAllMetrics();
    }
  }, [selectedAgentPhone]);

  const fetchAllMetrics = async () => {
    if (!selectedAgentPhone) return;
    
    try {
      setLoading(true);
      
      // First get all events for this agent
      const eventsResponse = await fetch(
        `https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos?telefone_pri=${encodeURIComponent(selectedAgentPhone)}`
      );
      
      if (!eventsResponse.ok) {
        throw new Error('Erro ao buscar eventos');
      }
      
      const eventsData = await eventsResponse.json();
      const events = eventsData.eventos || eventsData || [];
      
      if (events.length === 0) {
        setAllEventsData([]);
        setLastAppUpdate(new Date().toLocaleString('pt-BR'));
        return;
      }
      
      // Fetch data for each event
      const allData: EventMetrics[] = [];
      
      for (const event of events) {
        try {
          const eventId = String(event.id_evento || event.id);
          
          const response = await fetch(
            `https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos?telefone_pri=${encodeURIComponent(selectedAgentPhone)}&id_evento=${encodeURIComponent(eventId)}`
          );
          
          if (!response.ok) continue;
          
          const data = await response.json();
          const leadsData = data.contatos || data.leads || data || [];
          
          const eventLeads = leadsData.map((lead: any) => ({
            ...lead,
            evento_id: eventId,
            evento_nome: event.nome || event.name,
            marca: lead.marca || event.marca,
            estado: lead.estado || lead.uf || event.uf || event.estado,
            atendido: lead.ligacao_atendida,
            agendado: lead.status_agendado,
            erro: lead.ligacao_erro && !lead.status_agendado,
            whatsapp_enviado: lead.enviado_whatsapp,
          }));

          allData.push({
            eventId,
            eventName: event.nome || event.name,
            marca: event.marca,
            estado: event.uf || event.estado,
            cidade: event.cidade,
            telefone_pri: event.telefone_pri,
            leads: eventLeads,
            metricas: {
              totalLeads: eventLeads.length,
              leadsAtendidos: eventLeads.filter((l: LeadData) => l.atendido).length,
              leadsEmFila: eventLeads.filter((l: LeadData) => l.erro && !l.agendado).length,
              leadsAgendados: eventLeads.filter((l: LeadData) => l.agendado).length,
              mensagensEnviadas: eventLeads.filter((l: LeadData) => l.whatsapp_enviado).length,
            },
          });
        } catch (error) {
          console.error(`Error fetching data for event ${event.id_evento}:`, error);
        }
      }
      
      setAllEventsData(allData);
      setLastAppUpdate(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar métricas');
      setAllEventsData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get all unique values for filters
  const filterOptions = useMemo(() => {
    const eventNameCounts: Record<string, number> = {};
    const eventos = allEventsData.map(e => {
      const name = e.eventName || 'Sem nome';
      eventNameCounts[name] = (eventNameCounts[name] || 0) + 1;
      return { id: e.eventId, name, count: eventNameCounts[name] };
    });
    
    const nameTotals: Record<string, number> = {};
    allEventsData.forEach(e => {
      const name = e.eventName || 'Sem nome';
      nameTotals[name] = (nameTotals[name] || 0) + 1;
    });
    
    const eventosFormatted = eventos.map(e => ({
      id: e.id,
      displayName: nameTotals[e.name] > 1 ? `${e.name} (${e.count})` : e.name
    }));
    
    return { eventos: eventosFormatted };
  }, [allEventsData]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    return allEventsData.map(eventData => {
      const matchesEvento = !filters.evento || filters.evento === '__all__' || eventData.eventId === filters.evento;
      
      if (!matchesEvento) {
        return null;
      }

      // Filter leads
      const filteredLeads = eventData.leads.filter(lead => {
        const matchesAtendidos = !filters.showOnlyAtendidos || lead.atendido;
        const matchesAgendados = !filters.showOnlyAgendados || lead.agendado;
        const matchesEmFila = !filters.showOnlyEmFila || lead.erro;
        const matchesWhatsapp = !filters.showOnlyWhatsapp || lead.whatsapp_enviado;
        
        return matchesAtendidos && matchesAgendados && matchesEmFila && matchesWhatsapp;
      });

      return {
        ...eventData,
        leads: filteredLeads,
        metricas: {
          totalLeads: filteredLeads.length,
          leadsAtendidos: filteredLeads.filter(l => l.atendido).length,
          leadsEmFila: filteredLeads.filter(l => l.erro && !l.agendado).length,
          leadsAgendados: filteredLeads.filter(l => l.agendado).length,
          mensagensEnviadas: filteredLeads.filter(l => l.whatsapp_enviado).length,
        },
      };
    }).filter(Boolean) as EventMetrics[];
  }, [allEventsData, filters]);

  // Aggregate metrics
  const aggregatedMetrics = useMemo(() => {
    return filteredData.reduce((acc, event) => {
      return {
        totalLeads: acc.totalLeads + event.metricas.totalLeads,
        leadsAtendidos: acc.leadsAtendidos + event.metricas.leadsAtendidos,
        leadsEmFila: acc.leadsEmFila + event.metricas.leadsEmFila,
        leadsAgendados: acc.leadsAgendados + event.metricas.leadsAgendados,
        mensagensEnviadas: acc.mensagensEnviadas + event.metricas.mensagensEnviadas,
        totalEventos: acc.totalEventos + 1,
      };
    }, {
      totalLeads: 0,
      leadsAtendidos: 0,
      leadsEmFila: 0,
      leadsAgendados: 0,
      mensagensEnviadas: 0,
      totalEventos: 0,
    });
  }, [filteredData]);

  const clearFilters = () => {
    setFilters({
      telefone_pri: '',
      evento: '',
      showOnlyAtendidos: false,
      showOnlyAgendados: false,
      showOnlyEmFila: false,
      showOnlyWhatsapp: false,
    });
  };

  const calculatePercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const activeFiltersCount = [
    filters.evento && filters.evento !== '__all__' ? filters.evento : '',
    filters.showOnlyAtendidos ? 'atendidos' : '',
    filters.showOnlyAgendados ? 'agendados' : '',
    filters.showOnlyEmFila ? 'emfila' : '',
    filters.showOnlyWhatsapp ? 'whatsapp' : '',
  ].filter(Boolean).length;

  if (!selectedAgentPhone) {
    return (
      <Card className="p-8 text-center">
        <Phone className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Selecione um Agente</h3>
        <p className="text-sm text-muted-foreground">
          Selecione um agente Pri - Ligação para visualizar as métricas
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Métricas Gerais</h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de todos os eventos
          </p>
          {lastAppUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização: {lastAppUpdate}
            </p>
          )}
        </div>
        
        <Button variant="outline" size="sm" onClick={fetchAllMetrics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className="gap-2 relative"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        {filterOptions.eventos.length > 0 && (
          <Select 
            value={filters.evento || '__all__'} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, evento: value === '__all__' ? '' : value }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os eventos</SelectItem>
              {filterOptions.eventos.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Active Filters Tags */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.evento && filters.evento !== '__all__' && (
            <Badge variant="secondary" className="gap-1">
              Evento: {filterOptions.eventos.find(e => e.id === filters.evento)?.displayName || filters.evento}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, evento: '' }))} />
            </Badge>
          )}
          {filters.showOnlyAtendidos && (
            <Badge variant="secondary" className="gap-1">
              Atendidas
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, showOnlyAtendidos: false }))} />
            </Badge>
          )}
          {filters.showOnlyAgendados && (
            <Badge variant="secondary" className="gap-1">
              Agendados
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, showOnlyAgendados: false }))} />
            </Badge>
          )}
          {filters.showOnlyEmFila && (
            <Badge variant="secondary" className="gap-1">
              Em Fila
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, showOnlyEmFila: false }))} />
            </Badge>
          )}
          {filters.showOnlyWhatsapp && (
            <Badge variant="secondary" className="gap-1">
              WhatsApp Enviado
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, showOnlyWhatsapp: false }))} />
            </Badge>
          )}
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Leads
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{aggregatedMetrics.totalLeads}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Em {aggregatedMetrics.totalEventos} evento{aggregatedMetrics.totalEventos !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Atendidos
            </CardTitle>
            <PhoneCall className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{aggregatedMetrics.leadsAtendidos}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.leadsAtendidos, aggregatedMetrics.totalLeads)} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Fila
            </CardTitle>
            <PhoneOff className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{aggregatedMetrics.leadsEmFila}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.leadsEmFila, aggregatedMetrics.totalLeads)} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Agendados
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{aggregatedMetrics.leadsAgendados}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.leadsAgendados, aggregatedMetrics.totalLeads)} do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WhatsApp Enviados
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{aggregatedMetrics.mensagensEnviadas}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mensagens enviadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Eventos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{aggregatedMetrics.totalEventos}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Eventos ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Performance</CardTitle>
          <CardDescription>
            Indicadores consolidados de todas as operações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {calculatePercentage(aggregatedMetrics.leadsAtendidos, aggregatedMetrics.totalLeads)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Atendimento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {calculatePercentage(aggregatedMetrics.leadsAgendados, aggregatedMetrics.totalLeads)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Agendamento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-destructive">
                {calculatePercentage(aggregatedMetrics.leadsEmFila, aggregatedMetrics.totalLeads)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa Em Fila</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">
                {aggregatedMetrics.leadsAtendidos > 0 
                  ? ((aggregatedMetrics.leadsAgendados / aggregatedMetrics.leadsAtendidos) * 100).toFixed(1) 
                  : '0'}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Conversão (Atendido → Agendado)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

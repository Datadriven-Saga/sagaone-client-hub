import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Phone, PhoneCall, PhoneOff, CalendarCheck, MessageSquare, TrendingUp, 
  RefreshCw, Users, Clock, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface EventMetrics {
  eventId: string;
  eventName: string;
  marca?: string;
  estado?: string;
  cidade?: string;
  telefone_pri?: string;
  metricas: {
    total: number;
    pendentes: number;
    disparados: number;
    emFila: number;
    encerrados: number;
    agendados: number;
    whatsappEnviado: number;
    atendidos: number;
  };
}

export const MetricasLigacaoTab = ({ selectedAgentPhone }: MetricasLigacaoTabProps) => {
  const { activeCompany } = useCompany();
  const [allEventsData, setAllEventsData] = useState<EventMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastAppUpdate, setLastAppUpdate] = useState('');
  const [selectedEvento, setSelectedEvento] = useState<string>('__all__');

  useEffect(() => {
    if (selectedAgentPhone && activeCompany?.id) {
      fetchAllMetrics();
    }
  }, [selectedAgentPhone, activeCompany?.id]);

  const fetchAllMetrics = async () => {
    if (!selectedAgentPhone) return;
    
    try {
      setLoading(true);
      
      // Buscar eventos da tabela eventos_pri_voz filtrados por telefone_pri
      console.log('📊 Métricas - Buscando eventos para telefone_pri:', selectedAgentPhone);
      
      const { data: eventsFromDb, error: eventsDbError } = await supabase
        .from('eventos_pri_voz')
        .select('id_evento, nome, marca, uf, cidade, telefone_pri')
        .eq('telefone_pri', selectedAgentPhone)
        .order('data_inicio', { ascending: false });
      
      if (eventsDbError) {
        console.error('❌ Erro ao buscar eventos:', eventsDbError);
        throw new Error('Erro ao buscar eventos');
      }
      
      const events = eventsFromDb || [];
      console.log(`✅ Métricas - ${events.length} eventos encontrados`);
      
      if (events.length === 0) {
        setAllEventsData([]);
        setLastAppUpdate(new Date().toLocaleString('pt-BR'));
        return;
      }
      
      // Buscar métricas de TODOS eventos em PARALELO (sem sincronização N8N bloqueante)
      const metricsPromises = events.map(async (event) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
            body: { 
              id_evento: event.id_evento,
              empresa_id: activeCompany?.id,
              telefone_pri: event.telefone_pri,
              page: 1,
              page_size: 1, // Só métricas, não dados
            },
          });
          
          if (error || !data?.success) {
            return null;
          }
          
          const metricas = data.metricas || {};
          
          return {
            eventId: String(event.id_evento),
            eventName: event.nome || 'Evento sem nome',
            marca: event.marca,
            estado: event.uf,
            cidade: event.cidade,
            telefone_pri: event.telefone_pri,
            metricas: {
              total: metricas.total || 0,
              pendentes: metricas.pendentes || 0,
              disparados: metricas.disparados || 0,
              emFila: metricas.emFila || 0,
              encerrados: metricas.encerrados || 0,
              agendados: metricas.agendados || 0,
              whatsappEnviado: metricas.whatsappEnviado || 0,
              atendidos: metricas.atendidos || 0,
            },
          } as EventMetrics;
        } catch (error) {
          console.warn(`Error fetching metrics for event ${event.id_evento}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(metricsPromises);
      const allData = results.filter((r): r is EventMetrics => r !== null);
      
      setAllEventsData(allData);
      setLastAppUpdate(new Date().toLocaleString('pt-BR'));
      
      // Sincronização N8N em background (não-bloqueante)
      events.forEach(event => {
        supabase.functions.invoke('sync-pri-dashboard', {
          body: {
            telefone_pri: selectedAgentPhone.replace(/\D/g, ''),
            id_evento: event.id_evento,
            empresa_id: activeCompany?.id,
          }
        }).catch(() => {}); // Ignorar erros de sync em background
      });
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar métricas');
      setAllEventsData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar por evento selecionado
  const filteredData = useMemo(() => {
    if (selectedEvento === '__all__') {
      return allEventsData;
    }
    return allEventsData.filter(e => e.eventId === selectedEvento);
  }, [allEventsData, selectedEvento]);

  // Agregar métricas de todos os eventos filtrados
  const aggregatedMetrics = useMemo(() => {
    return filteredData.reduce((acc, event) => {
      return {
        total: acc.total + event.metricas.total,
        pendentes: acc.pendentes + event.metricas.pendentes,
        disparados: acc.disparados + event.metricas.disparados,
        emFila: acc.emFila + event.metricas.emFila,
        encerrados: acc.encerrados + event.metricas.encerrados,
        agendados: acc.agendados + event.metricas.agendados,
        whatsappEnviado: acc.whatsappEnviado + event.metricas.whatsappEnviado,
        atendidos: acc.atendidos + event.metricas.atendidos,
        totalEventos: acc.totalEventos + 1,
      };
    }, {
      total: 0,
      pendentes: 0,
      disparados: 0,
      emFila: 0,
      encerrados: 0,
      agendados: 0,
      whatsappEnviado: 0,
      atendidos: 0,
      totalEventos: 0,
    });
  }, [filteredData]);

  const calculatePercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

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
          <h2 className="text-xl font-bold">Métricas Consolidadas</h2>
          <p className="text-sm text-muted-foreground">
            Dados agregados de todos os eventos (apenas contadores)
          </p>
          {lastAppUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização: {lastAppUpdate}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {allEventsData.length > 0 && (
            <Select value={selectedEvento} onValueChange={setSelectedEvento}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os eventos ({allEventsData.length})</SelectItem>
                {allEventsData.map(e => (
                  <SelectItem key={e.eventId} value={e.eventId}>{e.eventName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button variant="outline" size="sm" onClick={fetchAllMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Main Metrics Grid - Apenas contadores agregados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Leads
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{aggregatedMetrics.total.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Em {aggregatedMetrics.totalEventos} evento{aggregatedMetrics.totalEventos !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{aggregatedMetrics.pendentes.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.pendentes, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disparados
            </CardTitle>
            <Phone className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{aggregatedMetrics.disparados.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.disparados, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Fila
            </CardTitle>
            <PhoneOff className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{aggregatedMetrics.emFila.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.emFila, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atendidos
            </CardTitle>
            <PhoneCall className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{aggregatedMetrics.atendidos.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.atendidos, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#04bbda]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agendados
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-[#04bbda]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#04bbda]">{aggregatedMetrics.agendados.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.agendados, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WhatsApp Enviados
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{aggregatedMetrics.whatsappEnviado.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.whatsappEnviado, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Encerrados
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-600">{aggregatedMetrics.encerrados.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculatePercentage(aggregatedMetrics.encerrados, aggregatedMetrics.total)} do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Performance</CardTitle>
          <CardDescription>
            Indicadores consolidados (dados agregados, sem informações individuais)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {calculatePercentage(aggregatedMetrics.atendidos, aggregatedMetrics.total)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Atendimento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-[#04bbda]">
                {calculatePercentage(aggregatedMetrics.agendados, aggregatedMetrics.total)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Agendamento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {calculatePercentage(aggregatedMetrics.disparados, aggregatedMetrics.total)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Disparo</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">
                {aggregatedMetrics.atendidos > 0 
                  ? ((aggregatedMetrics.agendados / aggregatedMetrics.atendidos) * 100).toFixed(1) 
                  : '0'}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Conversão (Atendido → Agendado)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Event Summary (if multiple events) */}
      {selectedEvento === '__all__' && allEventsData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Métricas por Evento</CardTitle>
            <CardDescription>
              Contadores individuais de cada evento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allEventsData.map(event => (
                <div key={event.eventId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{event.eventName}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.cidade}{event.estado ? `, ${event.estado}` : ''}
                      {event.marca ? ` • ${event.marca}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-primary">{event.metricas.total.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-green-600">{event.metricas.atendidos.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">Atendidos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[#04bbda]">{event.metricas.agendados.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">Agendados</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-orange-600">{event.metricas.emFila.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">Em Fila</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

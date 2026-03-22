import { useState, useEffect, useMemo, useCallback } from 'react';
import { ResultadosLigacaoSkeleton } from '@/components/resultados/ResultadosSkeleton';
import {
  Loader2, Phone, PhoneCall, CalendarCheck,
  RefreshCw, Users, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  initialEventId?: string | null;
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
    leadsContatados: number;
    ligacoesFeitas: number;
    encerrados: number;
    agendados: number;
    atendidos: number;
  };
}

// Helper functions (same as WhatsApp dashboard)
const pctFmt = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const numFmt = (n: number) => n.toLocaleString("pt-BR");
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export const MetricasLigacaoTab = ({ selectedAgentPhone, initialEventId }: MetricasLigacaoTabProps) => {
  const { activeCompany } = useCompany();
  const [allEventsData, setAllEventsData] = useState<EventMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastAppUpdate, setLastAppUpdate] = useState('');
  const [selectedEvento, setSelectedEvento] = useState<string>(initialEventId || '__all__');

  useEffect(() => {
    if (selectedAgentPhone && activeCompany?.id) {
      fetchAllMetrics();
    }
  }, [selectedAgentPhone, activeCompany?.id]);

  const fetchAllMetrics = async (skipSync = false) => {
    if (!selectedAgentPhone || !activeCompany?.id) return;
    
    try {
      setLoading(true);
      const t0 = performance.now();
      console.time('[Ligação] total-fetch');
      
      console.time('[Ligação] fetch-eventos-db');
      const { data: eventsFromDb, error: eventsDbError } = await supabase
        .from('eventos_pri_voz')
        .select('id_evento, nome, marca, uf, cidade, telefone_pri, empresa_id')
        .eq('telefone_pri', selectedAgentPhone)
        .eq('empresa_id', activeCompany.id)
        .order('data_inicio', { ascending: false });
      console.timeEnd('[Ligação] fetch-eventos-db');
      
      if (eventsDbError) {
        console.error('❌ Erro ao buscar eventos:', eventsDbError);
        throw new Error('Erro ao buscar eventos');
      }
      
      const events = eventsFromDb || [];
      
      if (events.length === 0) {
        setAllEventsData([]);
        setLastAppUpdate(new Date().toLocaleString('pt-BR'));
        console.timeEnd('[Ligação] total-fetch');
        return;
      }

      if (!skipSync) {
        console.time('[Ligação] sync-external');
        const syncBatchSize = 3;
        for (let i = 0; i < events.length; i += syncBatchSize) {
          const batch = events.slice(i, i + syncBatchSize);
          await Promise.allSettled(
            batch.map(event =>
              supabase.functions.invoke('sync-pri-dashboard', {
                body: {
                  telefone_pri: selectedAgentPhone.replace(/\D/g, ''),
                  id_evento: event.id_evento,
                  empresa_id: activeCompany?.id,
                },
              })
            )
          );
        }
        console.timeEnd('[Ligação] sync-external');
      }
      
      console.time('[Ligação] fetch-metrics-parallel');
      const metricsPromises = events.map(async (event) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
            body: {
              id_evento: event.id_evento,
              empresa_id: activeCompany?.id,
              telefone_pri: event.telefone_pri,
              page: 1,
              page_size: 10000,
              apenas_ligacao: true,
            },
          });
          
          if (error || !data?.success) return null;
          
          const metricas = data.metricas || {};
          const contatos = data.contatos || [];
          const leadsContatados = contatos.filter((c: any) => (c.num_tentativas || 0) > 0).length || (metricas.disparados1 || 0);
          
          return {
            eventId: String(event.id_evento),
            eventName: event.nome || 'Evento sem nome',
            marca: event.marca,
            estado: event.uf,
            cidade: event.cidade,
            telefone_pri: event.telefone_pri,
            metricas: {
              total: metricas.total || 0,
              leadsContatados,
              ligacoesFeitas: metricas.disparados1 || 0,
              encerrados: metricas.encerrados || 0,
              agendados: metricas.agendados || 0,
              atendidos: metricas.atendidos || 0,
            },
          } as EventMetrics;
        } catch (error) {
          console.warn(`Error fetching metrics for event ${event.id_evento}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(metricsPromises);
      console.timeEnd('[Ligação] fetch-metrics-parallel');
      
      setAllEventsData(results.filter((r): r is EventMetrics => r !== null));
      setLastAppUpdate(new Date().toLocaleString('pt-BR'));
      console.timeEnd('[Ligação] total-fetch');
      console.log(`[Ligação] Total: ${(performance.now() - t0).toFixed(0)}ms | ${events.length} eventos | ${results.filter(Boolean).length} com dados`);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar métricas');
      setAllEventsData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (selectedEvento === '__all__') return allEventsData;
    return allEventsData.filter(e => e.eventId === selectedEvento);
  }, [allEventsData, selectedEvento]);

  const aggregatedMetrics = useMemo(() => {
    return filteredData.reduce((acc, event) => ({
      total: acc.total + event.metricas.total,
      leadsContatados: acc.leadsContatados + event.metricas.leadsContatados,
      ligacoesFeitas: acc.ligacoesFeitas + event.metricas.ligacoesFeitas,
      encerrados: acc.encerrados + event.metricas.encerrados,
      agendados: acc.agendados + event.metricas.agendados,
      atendidos: acc.atendidos + event.metricas.atendidos,
      totalEventos: acc.totalEventos + 1,
    }), {
      total: 0,
      leadsContatados: 0,
      ligacoesFeitas: 0,
      encerrados: 0,
      agendados: 0,
      atendidos: 0,
      totalEventos: 0,
    });
  }, [filteredData]);

  // Funnel steps
  const funnelSteps = useMemo(() => {
    const m = aggregatedMetrics;
    return [
      { name: "Total de Leads", count: m.total, desc: "Total de leads na base do evento", key: "total" },
      { name: "Leads Contatados", count: m.leadsContatados, desc: "Leads que receberam pelo menos 1 ligação", key: "contatados" },
      { name: "Atendidos", count: m.atendidos, desc: "Leads que atenderam a ligação", key: "atendidos" },
      { name: "Agendados", count: m.agendados, desc: "Leads que agendaram visita", key: "agendados" },
    ];
  }, [aggregatedMetrics]);

  // Losses
  const losses = useMemo(() => {
    const m = aggregatedMetrics;
    const naoContatados = m.total - m.leadsContatados;
    const naoAtendidos = m.leadsContatados - m.atendidos;
    return [
      { name: "Não contatados", count: naoContatados, desc: "Leads que não receberam nenhuma ligação" },
      { name: "Não atendidos", count: naoAtendidos, desc: "Leads contatados que não atenderam" },
    ].filter(l => l.count > 0);
  }, [aggregatedMetrics]);

  // KPI cards
  const kpiCards = useMemo(() => {
    const m = aggregatedMetrics;
    return [
      {
        label: "Total da base",
        value: numFmt(m.total),
        subText: `Contatados: ${pctFmt(safeDiv(m.leadsContatados, m.total))}`,
        subColor: "text-muted-foreground",
        borderColor: "border-l-[hsl(var(--primary))]",
        badgeText: null,
        badgeColor: "",
      },
      {
        label: "Leads Contatados",
        value: numFmt(m.leadsContatados),
        subText: `${pctFmt(safeDiv(m.leadsContatados, m.total))} da base`,
        subColor: "text-[hsl(210,80%,40%)]",
        borderColor: "border-l-[hsl(210,80%,40%)]",
        badgeText: `${pctFmt(safeDiv(m.leadsContatados, m.total))} da base`,
        badgeColor: "bg-[hsl(210,80%,93%)] text-[hsl(210,80%,35%)]",
      },
      {
        label: "Atendidos",
        value: numFmt(m.atendidos),
        subText: `${pctFmt(safeDiv(m.atendidos, m.total))} do total da base`,
        subColor: "text-[hsl(220,70%,45%)]",
        borderColor: "border-l-[hsl(220,70%,45%)]",
        badgeText: `${pctFmt(safeDiv(m.atendidos, m.leadsContatados))} dos contatados`,
        badgeColor: "bg-[hsl(220,70%,92%)] text-[hsl(220,70%,40%)]",
      },
      {
        label: "Agendados",
        value: numFmt(m.agendados),
        subText: `${pctFmt(safeDiv(m.agendados, m.total))} do total da base`,
        subColor: "text-[hsl(25,70%,45%)]",
        borderColor: "border-l-[hsl(25,70%,45%)]",
        badgeText: `${pctFmt(safeDiv(m.agendados, m.atendidos))} dos atendidos`,
        badgeColor: "bg-[hsl(25,80%,92%)] text-[hsl(25,70%,40%)]",
      },
    ];
  }, [aggregatedMetrics]);

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
    return <ResultadosLigacaoSkeleton />;
  }

  const leadBase = aggregatedMetrics.total || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Dashboard PRI — Ligação
            </h2>
            {lastAppUpdate && (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização: {lastAppUpdate}
              </p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {allEventsData.length > 0 && (
              <Select value={selectedEvento} onValueChange={setSelectedEvento}>
                <SelectTrigger className="w-full sm:w-[220px]">
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
            
            <Button variant="outline" size="sm" onClick={() => fetchAllMetrics(false)} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className={`rounded-xl bg-white dark:bg-[hsl(220,20%,14%)] border border-border/30 shadow-sm border-l-[7px] ${kpi.borderColor} p-6`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {kpi.label}
                </p>
                <p className="text-3xl font-bold text-foreground leading-none">
                  {kpi.value}
                </p>
                {kpi.subText && (
                  <p className={`text-sm font-medium mt-2 ${kpi.subColor}`}>
                    {kpi.subText}
                  </p>
                )}
              </div>
              {kpi.badgeText && (
                <div className="flex flex-col items-end shrink-0 pt-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${kpi.badgeColor}`}>
                    {kpi.badgeText}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Funnel de Leads */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-bold">Funil de leads</CardTitle>
            <Badge variant="outline" className="text-xs">
              Base → Contatados → Atendidos → Agendados
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
            Base {numFmt(aggregatedMetrics.total)} → Contatados {pctFmt(safeDiv(aggregatedMetrics.leadsContatados, aggregatedMetrics.total))} →
            Atendidos {pctFmt(safeDiv(aggregatedMetrics.atendidos, aggregatedMetrics.leadsContatados))} →
            Agendados {pctFmt(safeDiv(aggregatedMetrics.agendados, aggregatedMetrics.total))} da base.
          </p>
        </CardContent>
      </Card>

      {/* Resumo de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Performance</CardTitle>
          <CardDescription>
            Indicadores consolidados (dados agregados)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {pctFmt(safeDiv(aggregatedMetrics.atendidos, aggregatedMetrics.total))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Atendimento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-[#04bbda]">
                {pctFmt(safeDiv(aggregatedMetrics.agendados, aggregatedMetrics.total))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Agendamento</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {pctFmt(safeDiv(aggregatedMetrics.leadsContatados, aggregatedMetrics.total))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Contato</p>
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

      {/* Per-Event Summary */}
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
                <div key={event.eventId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/30 rounded-lg gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{event.eventName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.cidade}{event.estado ? `, ${event.estado}` : ''}
                      {event.marca ? ` • ${event.marca}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-sm flex-shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-primary">{event.metricas.total.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-blue-600">{event.metricas.leadsContatados.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Contatados</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-green-600">{event.metricas.atendidos.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Atendidos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[#04bbda]">{event.metricas.agendados.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Agendados</p>
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

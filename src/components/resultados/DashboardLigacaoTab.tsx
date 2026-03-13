import { useState, useMemo, useEffect } from 'react';
import { Search, Loader2, Phone, X, RefreshCw, PhoneCall, CalendarCheck, Users, Plus, Minus, Filter, TrendingUp, MessageSquare } from 'lucide-react';
import { SyncButton } from './SyncButton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';

interface DashboardLigacaoTabProps {
  selectedEventId: string | null;
  selectedAgentPhone: string | null;
  onEventChange?: (eventId: string) => void;
}

interface LeadData {
  id?: string;
  nome?: string;
  telefone_lead?: string;
  telefone_pri?: string;
  loja?: string;
  status?: string;
  proposal_id?: string;
  num_tentativas?: number;
  ultima_atualizacao?: string;
  ligacao_atendida?: boolean;
  status_agendado?: boolean;
  ligacao_erro?: boolean;
  enviado_whatsapp?: boolean;
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

interface Metricas {
  totalLeads: number;
  totalLigacoes: number;
  leadsAtendidos: number;
  leadsAgendados: number;
  enviadoWhatsapp: number;
}

interface LojaInfo {
  loja: string;
  total: number;
}

const PAGE_SIZE = 10;
const FETCH_ALL = 10000;

// Configuração das métricas em formato de funil (maior → menor)
const metricsConfig = [
  {
    key: 'totalLeads' as const,
    label: 'Total da base',
    icon: Users,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    subLabel: (m: Metricas) => m.totalLigacoes > 0 ? `Contatados: ${((m.totalLigacoes / m.totalLeads) * 100).toFixed(2)}%` : null,
  },
  {
    key: 'totalLigacoes' as const,
    label: 'Leads Contatados',
    icon: Phone,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    subLabel: (m: Metricas) => m.totalLeads > 0 ? `${((m.totalLigacoes / m.totalLeads) * 100).toFixed(2)}% da base` : null,
    subColor: 'text-red-400',
  },
  {
    key: 'leadsAtendidos' as const,
    label: 'Atendidos',
    icon: PhoneCall,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-500/10',
    subLabel: (m: Metricas) => m.totalLigacoes > 0 ? `${((m.leadsAtendidos / m.totalLigacoes) * 100).toFixed(2)}% dos contatados` : null,
    subColor: 'text-blue-400',
  },
  {
    key: 'enviadoWhatsapp' as const,
    label: 'Enviado WhatsApp',
    icon: MessageSquare,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    subLabel: (m: Metricas) => m.totalLigacoes > 0 ? `${((m.enviadoWhatsapp / m.totalLigacoes) * 100).toFixed(2)}% dos contatados` : null,
    subColor: 'text-emerald-400',
  },
  {
    key: 'leadsAgendados' as const,
    label: 'Agendados',
    icon: CalendarCheck,
    iconColor: 'text-[#04bbda]',
    iconBg: 'bg-[#04bbda]/10',
    subLabel: (m: Metricas) => m.totalLeads > 0 ? `${((m.leadsAgendados / m.totalLeads) * 100).toFixed(2)}% da base` : null,
    subColor: 'text-red-400',
  },
];

export const DashboardLigacaoTab = ({
  selectedEventId,
  selectedAgentPhone,
  onEventChange
}: DashboardLigacaoTabProps) => {
  const { activeCompany } = useCompany();
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [lojasDisponiveis, setLojasDisponiveis] = useState<LojaInfo[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    tentativas: '',
    showOnlyAtendidos: false,
    showOnlyAgendados: false,
    showOnlyEmFila: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAppUpdate, setLastAppUpdate] = useState('');
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [companyDealerId, setCompanyDealerId] = useState<string | null>(null);

  // Fetch company dealer_id (crm_id) for filtering events
  useEffect(() => {
    const fetchCompanyDealerId = async () => {
      if (!activeCompany?.id) { setCompanyDealerId(null); return; }
      try {
        const { data, error } = await supabase
          .from('empresas').select('crm_id').eq('id', activeCompany.id).single();
        if (error) { setCompanyDealerId(null); return; }
        setCompanyDealerId(data?.crm_id?.trim() || null);
      } catch { setCompanyDealerId(null); }
    };
    fetchCompanyDealerId();
  }, [activeCompany?.id]);

  useEffect(() => {
    if (selectedAgentPhone && companyDealerId) loadAvailableEvents();
  }, [selectedAgentPhone, companyDealerId]);

  useEffect(() => {
    if (selectedEventId && selectedAgentPhone) {
      setSelectedLoja('');
      setLojasDisponiveis([]);
      fetchDashboardData();
    }
  }, [selectedEventId, selectedAgentPhone]);

  useEffect(() => {
    if (selectedEventId && selectedAgentPhone && activeCompany?.id) fetchDashboardData();
  }, [selectedLoja, filters.showOnlyAtendidos, filters.showOnlyAgendados, filters.showOnlyEmFila, filters.tentativas]);

  const loadAvailableEvents = async () => {
    if (!selectedAgentPhone || !companyDealerId) return;
    try {
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { endpoint: 'verifica-eventos', telefone_pri: selectedAgentPhone, dealerid: companyDealerId },
      });
      if (error) throw new Error('Erro ao buscar eventos');
      const eventsArray = Array.isArray(data) ? data : (data?.dados_eventos || data?.eventos || []);
      const events = eventsArray.map((e: any) => ({
        id: String(e.id_evento || e.id),
        nome: e.evt_nome || e.nome || e.name || e.evento_nome || 'Evento sem nome',
        telefone_pri: e.telefone_pri, cidade: e.cidade, uf: e.uf || e.estado, estado: e.uf || e.estado, marca: e.marca,
      }));
      setAvailableEvents(events);
      if (selectedEventId) {
        const event = events.find((e: EventData) => e.id === selectedEventId);
        if (event) setSelectedEvent(event);
      }
    } catch { toast.error('Erro ao carregar eventos'); }
  };

  const fetchDashboardData = async () => {
    if (!selectedEventId || !selectedAgentPhone || !activeCompany?.id) return;
    try {
      setLoading(true);
      const idEventoNum = parseInt(selectedEventId, 10);
      const apiFilters: Record<string, string> = {};
      if (filters.search) apiFilters.search = filters.search;
      if (filters.showOnlyAtendidos) apiFilters.status_ligacao = 'atendido';
      else if (filters.showOnlyAgendados) apiFilters.status_ligacao = 'agendado';
      else if (filters.showOnlyEmFila) apiFilters.status_ligacao = 'em_fila';
      if (filters.tentativas && filters.tentativas !== '__all__') apiFilters.tentativas = filters.tentativas;

      const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
        body: {
          id_evento: idEventoNum, empresa_id: activeCompany.id, telefone_pri: selectedAgentPhone,
          loja: selectedLoja || undefined, page: 1, page_size: FETCH_ALL, apenas_ligacao: true,
          filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
        },
      });
      if (error) throw new Error('Erro ao buscar dados do Supabase');

      if (data?.lojas && Array.isArray(data.lojas)) setLojasDisponiveis(data.lojas);

      if (!data?.success || !data?.contatos || data.contatos.length === 0) {
        setLeads([]);
        setMetricas({ totalLeads: 0, totalLigacoes: 0, leadsAtendidos: 0, leadsAgendados: 0, enviadoWhatsapp: 0 });
        if (!selectedLoja) toast.info('Nenhum dado encontrado. Clique em "Sincronizar" para buscar dados.');
        setLastAppUpdate(new Date().toLocaleString('pt-BR'));
        return;
      }

      const processedLeads = data.contatos.map((lead: any) => ({
        id: lead.id, nome: lead.nome, telefone_lead: lead.telefone_lead, telefone_pri: lead.telefone_pri,
        loja: lead.loja, status: lead.status_calculado || calculateLeadStatus(lead), proposal_id: lead.proposal_id,
        num_tentativas: lead.num_tentativas ?? 0, ultima_atualizacao: lead.atualizado_em,
        ligacao_atendida: lead.ligacao_atendida ?? false, status_agendado: lead.status_agendado ?? false,
        ligacao_erro: lead.ligacao_erro ?? false, enviado_whatsapp: lead.enviado_whatsapp ?? false,
      }));
      setLeads(processedLeads);

      const leadsContatados = processedLeads.filter((l: LeadData) => (l.num_tentativas || 0) > 0).length;
      if (data.metricas) {
        setMetricas({ totalLeads: data.metricas.total, totalLigacoes: leadsContatados, leadsAtendidos: data.metricas.atendidos, leadsAgendados: data.metricas.agendados, enviadoWhatsapp: data.metricas.enviado_whatsapp || 0 });
      } else {
        setMetricas({
          totalLeads: processedLeads.length, totalLigacoes: leadsContatados,
          leadsAtendidos: processedLeads.filter((l: LeadData) => l.ligacao_atendida).length,
          leadsAgendados: processedLeads.filter((l: LeadData) => l.status_agendado).length,
          enviadoWhatsapp: processedLeads.filter((l: LeadData) => l.enviado_whatsapp).length,
        });
      }
      setLastAppUpdate(new Date().toLocaleString('pt-BR'));
    } catch { toast.error('Erro ao carregar dados do dashboard'); setLeads([]); setMetricas(null); }
    finally { setLoading(false); }
  };

  const calculateLeadStatus = (lead: any): string => {
    if (lead.status_agendado) return 'agendado';
    if (lead.ligacao_atendida) return 'atendido';
    if (lead.ligacao_erro) return 'em fila';
    return 'pendente';
  };

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { label: string; className: string }> = {
      'pendente': { label: 'Pendente', className: 'bg-muted text-muted-foreground border-border' },
      'atendido': { label: 'Atendido', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'agendado': { label: 'Agendado', className: 'bg-[#04bbda]/10 text-[#04bbda] border-[#04bbda]/20' },
      'em fila': { label: 'Em Fila', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    };
    const c = cfg[status] || cfg['pendente'];
    return <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", c.className)}>{c.label}</span>;
  };

  const getTentativasBadge = (tentativas: number) => (
    <span className={cn(
      "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors",
      tentativas === 0 && "bg-muted text-muted-foreground",
      tentativas === 1 && "bg-yellow-500/10 text-yellow-500",
      tentativas === 2 && "bg-orange-500/10 text-orange-500",
      tentativas >= 3 && "bg-red-500/10 text-red-500"
    )}>
      {tentativas}
    </span>
  );

  const statusOptions = ['pendente', 'atendido', 'agendado', 'em fila'];

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const query = filters.search.toLowerCase();
      const matchesSearch = !query || lead.nome?.toLowerCase().includes(query) || lead.telefone_lead?.includes(query) || lead.status?.includes(query);
      const matchesStatus = !filters.status || filters.status === '__all__' || lead.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [leads, filters.search, filters.status]);

  const displayMetrics = useMemo(() => {
    if (filters.search || (filters.status && filters.status !== '__all__')) {
      const leadsContatados = filteredLeads.filter(l => (l.num_tentativas || 0) > 0).length;
      return {
        totalLeads: filteredLeads.length, totalLigacoes: leadsContatados,
        leadsAtendidos: filteredLeads.filter(l => l.ligacao_atendida).length,
        leadsAgendados: filteredLeads.filter(l => l.status_agendado).length,
        enviadoWhatsapp: filteredLeads.filter(l => l.enviado_whatsapp).length,
      };
    }
    return metricas || { totalLeads: 0, totalLigacoes: 0, leadsAtendidos: 0, leadsAgendados: 0, enviadoWhatsapp: 0 };
  }, [filteredLeads, metricas, filters.search, filters.status]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);

  const handleEventChange = (eventId: string) => {
    const event = availableEvents.find(e => e.id === eventId);
    if (event) { setSelectedEvent(event); onEventChange?.(eventId); }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleString('pt-BR'); } catch { return dateString; }
  };

  const clearFilters = () => {
    setFilters({ search: '', status: '', tentativas: '', showOnlyAtendidos: false, showOnlyAgendados: false, showOnlyEmFila: false });
    setSelectedLoja('');
  };

  const activeFiltersCount = [
    filters.search, selectedLoja, filters.status && filters.status !== '__all__' ? filters.status : '',
    filters.tentativas && filters.tentativas !== '__all__' ? filters.tentativas : '',
    filters.showOnlyAtendidos ? 'a' : '', filters.showOnlyAgendados ? 'a' : '', filters.showOnlyEmFila ? 'a' : '',
  ].filter(Boolean).length;

  if (!selectedAgentPhone) {
    return (
      <Card className="p-12 text-center border-dashed">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Selecione um Agente</h3>
            <p className="text-sm text-muted-foreground">Selecione um agente Pri - Ligação para visualizar o dashboard</p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Dashboard PRI — Ligação</h2>
              {lastAppUpdate && (
                <p className="text-xs text-muted-foreground">Última atualização: {lastAppUpdate}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Event Switcher */}
            {availableEvents.length > 0 && (
              <Select value={selectedEventId || ''} onValueChange={handleEventChange}>
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder="Selecionar evento..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEvents.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.nome} {event.cidade ? `- ${event.cidade}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-1.5">
              <SyncButton
                telefonePri={selectedAgentPhone}
                idEvento={selectedEventId}
                empresaId={activeCompany?.id || null}
                onSyncComplete={fetchDashboardData}
              />
              <Button variant="outline" size="icon" onClick={fetchDashboardData} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Event details + Loja switcher */}
        {(selectedEvent || lojasDisponiveis.length > 1) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedEvent && (
              <Badge variant="secondary" className="text-xs gap-1.5 py-1 px-2.5">
                📍 {selectedEvent.nome}
                {selectedEvent.cidade && selectedEvent.uf && <span>— {selectedEvent.cidade}, {selectedEvent.uf}</span>}
              </Badge>
            )}
            {selectedAgentPhone && (
              <Badge variant="outline" className="text-xs gap-1.5 py-1 px-2.5 font-mono">
                <Phone className="h-3 w-3" /> {selectedAgentPhone}
              </Badge>
            )}
            {lojasDisponiveis.length > 1 && (
              <Select value={selectedLoja || '__all__'} onValueChange={(v) => setSelectedLoja(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[240px] h-8 text-xs border-primary/30 bg-primary/5">
                  <SelectValue placeholder="Selecionar loja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    Todas as lojas ({lojasDisponiveis.reduce((acc, l) => acc + l.total, 0)})
                  </SelectItem>
                  {lojasDisponiveis.map(loja => (
                    <SelectItem key={loja.loja} value={loja.loja}>
                      {loja.loja} ({loja.total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricsConfig.map((metric) => {
          const value = displayMetrics[metric.key];
          const Icon = metric.icon;
          const sub = metric.subLabel(displayMetrics);
          return (
            <Card key={metric.key} className="relative overflow-hidden border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </p>
                  <div className={cn("p-2 rounded-lg", metric.iconBg)}>
                    <Icon className={cn("h-4 w-4", metric.iconColor)} />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {value.toLocaleString('pt-BR')}
                </p>
                {sub && (
                  <p className={cn("text-xs mt-1.5 font-medium", (metric as any).subColor || 'text-muted-foreground')}>
                    {sub}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Funnel indicator */}
      {displayMetrics.totalLeads > 0 && (
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Funil de leads
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-muted">Base</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">Contatados</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500">Atendidos</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-[#04bbda]/10 text-[#04bbda]">Agendados</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setCurrentPage(1); }}
              placeholder="Filtrar por telefone, nome..."
              className="pl-10 h-9"
            />
          </div>

          <Select value={filters.status || '__all__'} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === '__all__' ? '' : v }))}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos status</SelectItem>
              {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 bg-background border rounded-md px-2 h-9">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => {
                const c = filters.tentativas ? parseInt(filters.tentativas) : -1;
                if (c > 0) setFilters(p => ({ ...p, tentativas: String(c - 1) }));
                else if (c === 0) setFilters(p => ({ ...p, tentativas: '' }));
              }}
              disabled={!filters.tentativas}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm font-medium">
              {filters.tentativas ? `${filters.tentativas} tent.` : 'Tentativas'}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => {
                const c = filters.tentativas ? parseInt(filters.tentativas) : -1;
                if (c < 3) setFilters(p => ({ ...p, tentativas: String(c + 1) }));
              }}
              disabled={filters.tentativas === '3'}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Select
            value={filters.showOnlyAtendidos ? 'atendidos' : filters.showOnlyAgendados ? 'agendados' : filters.showOnlyEmFila ? 'emfila' : '__all__'}
            onValueChange={(v) => setFilters(p => ({
              ...p, showOnlyAtendidos: v === 'atendidos', showOnlyAgendados: v === 'agendados', showOnlyEmFila: v === 'emfila',
            }))}
          >
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Filtrar status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__"><span className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Todos</span></SelectItem>
              <SelectItem value="atendidos"><span className="flex items-center gap-2"><PhoneCall className="h-3.5 w-3.5 text-green-500" /> Atendidas</span></SelectItem>
              <SelectItem value="agendados"><span className="flex items-center gap-2"><CalendarCheck className="h-3.5 w-3.5 text-[#04bbda]" /> Agendados</span></SelectItem>
              <SelectItem value="emfila"><span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-orange-500" /> Em Fila</span></SelectItem>
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-9">
              <X className="h-3 w-3" /> Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {metricas && leads.length > 0 && (
            <div className="px-4 py-2.5 bg-muted/30 border-b text-sm text-muted-foreground flex items-center justify-between">
              <span>
                {filteredLeads.length.toLocaleString('pt-BR')} leads
                {metricas.totalLeads !== filteredLeads.length && ` de ${metricas.totalLeads.toLocaleString('pt-BR')}`}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-12 font-semibold text-xs">#</TableHead>
                  <TableHead className="font-semibold text-xs">Telefone</TableHead>
                  <TableHead className="font-semibold text-xs">Nome</TableHead>
                  <TableHead className="font-semibold text-xs">Proposal ID</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs">Loja</TableHead>
                  <TableHead className="text-center font-semibold text-xs">Tent.</TableHead>
                  <TableHead className="font-semibold text-xs">Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Phone className="h-8 w-8 opacity-20" />
                        <span>Nenhum lead encontrado</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead, index) => (
                    <TableRow key={lead.id || index} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium text-muted-foreground text-xs">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{lead.telefone_lead || '—'}</TableCell>
                      <TableCell className="text-sm">{lead.nome || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lead.proposal_id || '—'}</TableCell>
                      <TableCell>{getStatusBadge(lead.status || 'pendente')}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm" title={lead.loja}>{lead.loja || '—'}</TableCell>
                      <TableCell className="text-center">{getTentativasBadge(lead.num_tentativas || 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(lead.ultima_atualizacao)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-muted/10">
              <p className="text-xs text-muted-foreground">
                {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} de {filteredLeads.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage}/{totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { useState, useMemo, useEffect } from 'react';
import { Search, Loader2, Phone, X, RefreshCw, Calendar, PhoneCall, PhoneOff, CalendarCheck, Users, Plus, Minus, Filter } from 'lucide-react';
import { SyncButton } from './SyncButton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
}

interface LojaInfo {
  loja: string;
  total: number;
}

const PAGE_SIZE = 10;
const FETCH_ALL = 10000; // Buscar todos os registros para filtragem correta

// Configuração das métricas com cores e ícones
const metricsConfig = [
  {
    key: 'totalLeads' as const,
    label: 'Total Leads',
    icon: Users,
    borderColor: 'border-l-primary',
    iconColor: 'text-primary'
  },
  {
    key: 'totalLigacoes' as const,
    label: 'Leads Contatados',
    icon: Phone,
    borderColor: 'border-l-blue-500',
    iconColor: 'text-blue-600'
  },
  {
    key: 'leadsAtendidos' as const,
    label: 'Atendidos',
    icon: PhoneCall,
    borderColor: 'border-l-green-500',
    iconColor: 'text-green-600'
  },
  {
    key: 'leadsAgendados' as const,
    label: 'Agendados',
    icon: CalendarCheck,
    borderColor: 'border-l-[#04bbda]',
    iconColor: 'text-[#04bbda]'
  },
];

export const DashboardLigacaoTab = ({
  selectedEventId,
  selectedAgentPhone,
  onEventChange
}: DashboardLigacaoTabProps) => {
  const { activeCompany } = useCompany();
  const [selectedLoja, setSelectedLoja] = useState<string>(''); // Loja principal selecionada
  const [lojasDisponiveis, setLojasDisponiveis] = useState<LojaInfo[]>([]); // Lojas do evento
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
      if (!activeCompany?.id) {
        setCompanyDealerId(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('crm_id')
          .eq('id', activeCompany.id)
          .single();

        if (error) {
          console.error('Erro ao buscar crm_id da empresa:', error);
          setCompanyDealerId(null);
          return;
        }

        const dealerId = data?.crm_id?.trim() || null;
        console.log('🏪 Dashboard Ligação - Dealer ID (crm_id):', dealerId);
        setCompanyDealerId(dealerId);
      } catch (error) {
        console.error('Erro ao buscar dealer_id:', error);
        setCompanyDealerId(null);
      }
    };

    fetchCompanyDealerId();
  }, [activeCompany?.id]);

  useEffect(() => {
    if (selectedAgentPhone && companyDealerId) {
      loadAvailableEvents();
    }
  }, [selectedAgentPhone, companyDealerId]);

  useEffect(() => {
    if (selectedEventId && selectedAgentPhone) {
      // Reset loja selecionada ao trocar de evento
      setSelectedLoja('');
      setLojasDisponiveis([]);
      fetchDashboardData();
    }
  }, [selectedEventId, selectedAgentPhone]);

  // Recarregar quando mudar a loja selecionada ou filtros que precisam de API
  useEffect(() => {
    if (selectedEventId && selectedAgentPhone && activeCompany?.id) {
      fetchDashboardData();
    }
  }, [selectedLoja, filters.showOnlyAtendidos, filters.showOnlyAgendados, filters.showOnlyEmFila, filters.tentativas]);

  const loadAvailableEvents = async () => {
    if (!selectedAgentPhone || !companyDealerId) return;
    
    try {
      // Use edge function para consultar verifica-eventos com telefone_pri + dealerid
      console.log('📊 DashboardLigacao - Buscando eventos com telefone_pri:', selectedAgentPhone, 'e dealerid:', companyDealerId);
      
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { 
          endpoint: 'verifica-eventos', 
          telefone_pri: selectedAgentPhone,
          dealerid: companyDealerId
        },
      });
      
      if (error) {
        throw new Error('Erro ao buscar eventos');
      }
      
      console.log('📊 DashboardLigacao - Resposta eventos:', data);
      
      // A API retorna array de eventos filtrados pelo telefone_pri + dealerid
      const eventsArray = Array.isArray(data) ? data : (data?.dados_eventos || data?.eventos || []);
      
      const events = eventsArray.map((e: any) => ({
        id: String(e.id_evento || e.id),
        nome: e.evt_nome || e.nome || e.name || e.evento_nome || 'Evento sem nome',
        telefone_pri: e.telefone_pri,
        cidade: e.cidade,
        uf: e.uf || e.estado,
        estado: e.uf || e.estado,
        marca: e.marca,
      }));
      
      console.log(`✅ DashboardLigacao - ${events.length} eventos encontrados`);
      setAvailableEvents(events);
      
      // Set selected event if we have one
      if (selectedEventId) {
        const event = events.find((e: EventData) => e.id === selectedEventId);
        if (event) {
          setSelectedEvent(event);
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Erro ao carregar eventos');
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedEventId || !selectedAgentPhone || !activeCompany?.id) return;
    
    try {
      setLoading(true);
      
      const idEventoNum = parseInt(selectedEventId, 10);
      
      // Preparar filtros para enviar à API
      const apiFilters: {
        search?: string;
        status_ligacao?: string;
        tentativas?: string;
      } = {};
      
      // Filtro de busca
      if (filters.search) {
        apiFilters.search = filters.search;
      }
      
      // Filtro de status (atendidos, agendados, em fila)
      if (filters.showOnlyAtendidos) {
        apiFilters.status_ligacao = 'atendido';
      } else if (filters.showOnlyAgendados) {
        apiFilters.status_ligacao = 'agendado';
      } else if (filters.showOnlyEmFila) {
        apiFilters.status_ligacao = 'em_fila';
      }
      
      // Filtro de tentativas
      if (filters.tentativas && filters.tentativas !== '__all__') {
        apiFilters.tentativas = filters.tentativas;
      }
      
      console.log('📊 DashboardLigacao - Buscando dados via get-base-ligacao para evento:', idEventoNum, 'empresa:', activeCompany.id, 'loja:', selectedLoja || 'todas', 'filtros:', apiFilters);
      
      const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
        body: {
          id_evento: idEventoNum,
          empresa_id: activeCompany.id,
          telefone_pri: selectedAgentPhone,
          loja: selectedLoja || undefined,
          page: 1,
          page_size: FETCH_ALL, // Buscar todos para permitir paginação local
          filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
        },
      });
      
      if (error) {
        console.error('Erro ao buscar dados:', error);
        throw new Error('Erro ao buscar dados do Supabase');
      }
      
      // Atualizar lista de lojas disponíveis (sempre, independente de ter loja selecionada)
      if (data?.lojas && Array.isArray(data.lojas)) {
        setLojasDisponiveis(data.lojas);
        console.log(`🏪 ${data.lojas.length} lojas disponíveis:`, data.lojas.map((l: LojaInfo) => `${l.loja} (${l.total})`));
      }
      
      // Se não encontrou dados, pode ser que precise sincronizar
      if (!data?.success || !data?.contatos || data.contatos.length === 0) {
        console.log('⚠️ Nenhum dado encontrado. Clique em "Sincronizar" para buscar dados do n8n.');
        setLeads([]);
        setMetricas({
          totalLeads: 0,
          totalLigacoes: 0,
          leadsAtendidos: 0,
          leadsAgendados: 0,
        });
        if (!selectedLoja) {
          toast.info('Nenhum dado encontrado. Clique em "Sincronizar" para buscar dados do n8n.');
        }
        setLastAppUpdate(new Date().toLocaleString('pt-BR'));
        return;
      }
      
      console.log(`✅ Encontrados ${data.contatos.length} registros${selectedLoja ? ` para loja "${selectedLoja}"` : ''}`);
      
      // Processar leads (já vem com JOIN de cadencia_pri_voz)
      const processedLeads = data.contatos.map((lead: any) => ({
        id: lead.id,
        nome: lead.nome,
        telefone_lead: lead.telefone_lead,
        telefone_pri: lead.telefone_pri,
        loja: lead.loja,
        status: lead.status_calculado || calculateLeadStatus(lead),
        proposal_id: lead.proposal_id,
        num_tentativas: lead.num_tentativas ?? 0, // Agora vem do JOIN com cadencia_pri_voz
        ultima_atualizacao: lead.atualizado_em,
        ligacao_atendida: lead.ligacao_atendida ?? false,
        status_agendado: lead.status_agendado ?? false,
        ligacao_erro: lead.ligacao_erro ?? false,
      }));
      
      setLeads(processedLeads);
      
      // Usar métricas já calculadas pela edge function (considera JOIN + filtro de loja)
      // Leads contatados = leads que receberam pelo menos 1 ligação
      const leadsContatados = processedLeads.filter((l: LeadData) => (l.num_tentativas || 0) > 0).length;
      
      if (data.metricas) {
        setMetricas({
          totalLeads: data.metricas.total,
          totalLigacoes: leadsContatados,
          leadsAtendidos: data.metricas.atendidos,
          leadsAgendados: data.metricas.agendados,
        });
      } else {
        // Fallback
        setMetricas({
          totalLeads: processedLeads.length,
          totalLigacoes: leadsContatados,
          leadsAtendidos: processedLeads.filter((l: LeadData) => l.ligacao_atendida).length,
          leadsAgendados: processedLeads.filter((l: LeadData) => l.status_agendado).length,
        });
      }
      
      console.log('✅ Dashboard carregado com JOIN:', {
        loja: selectedLoja || 'todas',
        total: data.metricas?.total,
        atendidos: data.metricas?.atendidos,
        agendados: data.metricas?.agendados,
        comTentativas: processedLeads.filter((l: LeadData) => (l.num_tentativas || 0) > 0).length,
      });
      
      setLastAppUpdate(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
      setLeads([]);
      setMetricas(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateLeadStatus = (lead: any): string => {
    if (lead.status_agendado) return 'agendado';
    if (lead.ligacao_atendida) return 'atendido';
    if (lead.ligacao_erro) return 'em fila';
    return 'pendente';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'pendente': {
        label: 'Pendente',
        className: 'bg-muted text-muted-foreground border-border'
      },
      'atendido': {
        label: 'Atendido',
        className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
      },
      'agendado': {
        label: 'Agendado',
        className: 'bg-[#04bbda]/10 text-[#04bbda] border-[#04bbda]/30'
      },
      'em fila': {
        label: 'Em Fila',
        className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
      },
    };
    
    const config = statusConfig[status] || statusConfig['pendente'];
    return (
      <span className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap",
        config.className
      )}>
        {config.label}
      </span>
    );
  };

  const getActionIcon = (lead: LeadData) => {
    if (lead.status_agendado) {
      return <CalendarCheck className="h-4 w-4 text-[#04bbda]" />;
    }
    if (lead.ligacao_erro) {
      return <X className="h-4 w-4 text-destructive" />;
    }
    return <Phone className="h-4 w-4 text-muted-foreground" />;
  };

  const getTentativasBadge = (tentativas: number) => {
    return (
      <span className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
        tentativas === 0 && "bg-muted text-muted-foreground",
        tentativas === 1 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        tentativas === 2 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        tentativas >= 3 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      )}>
        {tentativas}
      </span>
    );
  };

  // Status options
  const statusOptions = ['pendente', 'atendido', 'agendado', 'em fila', 'não agendado'];

  // Filtros locais - apenas busca por texto e status (os filtros rápidos já foram aplicados na API)
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Filtro de busca por texto (local - mais fluido)
      const query = filters.search.toLowerCase();
      const matchesSearch =
        !query ||
        lead.nome?.toLowerCase().includes(query) ||
        lead.telefone_lead?.includes(query) ||
        lead.status?.includes(query);

      // Filtro de status por dropdown (local)
      const matchesStatus = !filters.status || filters.status === '__all__' || lead.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [leads, filters.search, filters.status]);

  // Métricas - usar os dados retornados da API (já filtrados pelo servidor)
  const displayMetrics = useMemo(() => {
    // Se há filtro de busca por texto local, recalcular métricas dos resultados filtrados
    if (filters.search || (filters.status && filters.status !== '__all__')) {
      const leadsContatados = filteredLeads.filter(l => (l.num_tentativas || 0) > 0).length;
      return {
        totalLeads: filteredLeads.length,
        totalLigacoes: leadsContatados,
        leadsAtendidos: filteredLeads.filter(l => l.ligacao_atendida).length,
        leadsAgendados: filteredLeads.filter(l => l.status_agendado).length,
        mensagensEnviadas: filteredLeads.filter(l => l.enviado_whatsapp).length,
      };
    }
    
    // Sem filtros locais, usar as métricas da API (que já consideram filtros do servidor)
    return metricas || {
      totalLeads: 0,
      totalLigacoes: 0,
      leadsAtendidos: 0,
      leadsAgendados: 0,
      mensagensEnviadas: 0,
    };
  }, [filteredLeads, metricas, filters.search, filters.status]);

  // Paginate filtered leads
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);

  const handleEventChange = (eventId: string) => {
    const event = availableEvents.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      onEventChange?.(eventId);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      tentativas: '',
      showOnlyAtendidos: false,
      showOnlyAgendados: false,
      showOnlyEmFila: false,
      showOnlyWhatsapp: false,
    });
    setSelectedLoja(''); // Também limpa a loja selecionada
  };

  const activeFiltersCount = [
    filters.search,
    selectedLoja ? selectedLoja : '', // Contabiliza loja selecionada
    filters.status && filters.status !== '__all__' ? filters.status : '',
    filters.tentativas && filters.tentativas !== '__all__' ? filters.tentativas : '',
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
          Selecione um agente Pri - Ligação para visualizar o dashboard
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Dashboard de Ligação</h2>
            
            {/* Event Switcher */}
            {availableEvents.length > 0 && (
              <Select value={selectedEventId || ''} onValueChange={handleEventChange}>
                <SelectTrigger className="w-full sm:w-[250px]">
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

            {/* LOJA SWITCHER - Principal */}
            {lojasDisponiveis.length > 1 && (
              <Select 
                value={selectedLoja || '__all__'} 
                onValueChange={(value) => setSelectedLoja(value === '__all__' ? '' : value)}
              >
                <SelectTrigger className="w-full sm:w-[280px] border-primary/50 bg-primary/5">
                  <SelectValue placeholder="Selecionar loja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <span className="font-medium">Todas as lojas ({lojasDisponiveis.reduce((acc, l) => acc + l.total, 0)} leads)</span>
                  </SelectItem>
                  {lojasDisponiveis.map(loja => (
                    <SelectItem key={loja.loja} value={loja.loja}>
                      {loja.loja} ({loja.total} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <SyncButton
              telefonePri={selectedAgentPhone}
              idEvento={selectedEventId}
              empresaId={activeCompany?.id || null}
              onSyncComplete={fetchDashboardData}
            />
            <Button variant="outline" size="sm" onClick={fetchDashboardData} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
        
        {selectedEvent && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {selectedEvent.nome}
              {selectedEvent.cidade && selectedEvent.uf && (
                <span> - {selectedEvent.cidade}, {selectedEvent.uf}</span>
              )}
            </div>
            {selectedAgentPhone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Agente IA: {selectedAgentPhone}
              </div>
            )}
            {selectedLoja && (
              <div className="flex items-center gap-1 text-primary font-medium">
                <span>🏪 {selectedLoja}</span>
              </div>
            )}
          </div>
        )}
        
        {lastAppUpdate && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {lastAppUpdate}
          </p>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setCurrentPage(1);
              }}
              placeholder="Filtrar por telefone, nome..."
              className="pl-10"
            />
          </div>
          
          <Select 
            value={filters.status || '__all__'} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === '__all__' ? '' : value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos status</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tentativas com botões +/- */}
          <div className="flex items-center gap-1 bg-background border rounded-md px-2 py-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const current = filters.tentativas ? parseInt(filters.tentativas) : -1;
                if (current > 0) {
                  setFilters(prev => ({ ...prev, tentativas: String(current - 1) }));
                } else if (current === 0) {
                  setFilters(prev => ({ ...prev, tentativas: '' }));
                }
              }}
              disabled={!filters.tentativas}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm font-medium">
              {filters.tentativas ? `${filters.tentativas} tent.` : 'Tentativas'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const current = filters.tentativas ? parseInt(filters.tentativas) : -1;
                if (current < 3) {
                  setFilters(prev => ({ ...prev, tentativas: String(current + 1) }));
                }
              }}
              disabled={filters.tentativas === '3'}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Status dropdown com ícones */}
          <Select 
            value={
              filters.showOnlyAtendidos ? 'atendidos' :
              filters.showOnlyAgendados ? 'agendados' :
              filters.showOnlyEmFila ? 'emfila' :
              filters.showOnlyWhatsapp ? 'whatsapp' : '__all__'
            } 
            onValueChange={(value) => {
              setFilters(prev => ({
                ...prev,
                showOnlyAtendidos: value === 'atendidos',
                showOnlyAgendados: value === 'agendados',
                showOnlyEmFila: value === 'emfila',
                showOnlyWhatsapp: value === 'whatsapp',
              }));
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar status..." />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="__all__">
                <span className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  Todos
                </span>
              </SelectItem>
              <SelectItem value="atendidos">
                <span className="flex items-center gap-2">
                  <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                  Atendidas
                </span>
              </SelectItem>
              <SelectItem value="agendados">
                <span className="flex items-center gap-2">
                  <CalendarCheck className="h-3.5 w-3.5 text-[#04bbda]" />
                  Agendados
                </span>
              </SelectItem>
              <SelectItem value="emfila">
                <span className="flex items-center gap-2">
                  <PhoneOff className="h-3.5 w-3.5 text-orange-600" />
                  Em Fila
                </span>
              </SelectItem>
              <SelectItem value="whatsapp">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  WhatsApp
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3 w-3" />
              Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricsConfig.map((metric) => {
          const value = displayMetrics[metric.key];
          const Icon = metric.icon;
          return (
            <Card key={metric.key} className={cn("border-l-4 shadow-sm", metric.borderColor)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {metric.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">
                      {value.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-muted">
                    <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", metric.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {metricas && leads.length > 0 && (
            <div className="px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground flex items-center gap-2">
              <span>📋</span>
              <span>
                Exibindo {filteredLeads.length.toLocaleString('pt-BR')} leads{metricas.totalLeads !== filteredLeads.length ? ` (de ${metricas.totalLeads.toLocaleString('pt-BR')} total)` : ''}.
              </span>
            </div>
          )}
          <Table className="min-w-[900px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12 font-semibold">#</TableHead>
                <TableHead className="font-semibold">Telefone</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Proposal ID</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Loja</TableHead>
                <TableHead className="text-center font-semibold">Tentativas</TableHead>
                <TableHead className="font-semibold">Última Atualização</TableHead>
                <TableHead className="text-center font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLeads.map((lead, index) => (
                  <TableRow key={lead.id || index} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {lead.telefone_lead || '—'}
                    </TableCell>
                    <TableCell>{lead.nome || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.proposal_id || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(lead.status || 'pendente')}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={lead.loja}>
                      {lead.loja || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {getTentativasBadge(lead.num_tentativas || 0)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(lead.ultima_atualizacao)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getActionIcon(lead)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} de {filteredLeads.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
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

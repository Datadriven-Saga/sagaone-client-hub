import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Loader2, Phone, MessageSquare, X, RefreshCw, Calendar, PhoneCall, PhoneOff, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  leadsAtendidos: number;
  leadsEmFila: number;
  leadsAgendados: number;
  mensagensEnviadas: number;
}

const PAGE_SIZE = 10;

export const DashboardLigacaoTab = ({ 
  selectedEventId, 
  selectedAgentPhone,
  onEventChange 
}: DashboardLigacaoTabProps) => {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    loja: '',
    status: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAppUpdate, setLastAppUpdate] = useState('');
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  useEffect(() => {
    if (selectedAgentPhone) {
      loadAvailableEvents();
    }
  }, [selectedAgentPhone]);

  useEffect(() => {
    if (selectedEventId && selectedAgentPhone) {
      fetchDashboardData();
    }
  }, [selectedEventId, selectedAgentPhone]);

  const loadAvailableEvents = async () => {
    if (!selectedAgentPhone) return;
    
    try {
      const response = await fetch(
        `https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos?telefone_pri=${encodeURIComponent(selectedAgentPhone)}`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar eventos');
      }
      
      const data = await response.json();
      const events = (data.eventos || data || []).map((e: any) => ({
        id: String(e.id_evento || e.id),
        nome: e.nome || e.name,
        telefone_pri: e.telefone_pri,
        cidade: e.cidade,
        uf: e.uf || e.estado,
        estado: e.uf || e.estado,
        marca: e.marca,
      }));
      
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
    if (!selectedEventId || !selectedAgentPhone) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos?telefone_pri=${encodeURIComponent(selectedAgentPhone)}&id_evento=${encodeURIComponent(selectedEventId)}`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados');
      }
      
      const data = await response.json();
      const leadsData = data.contatos || data.leads || data || [];
      
      // Process leads
      const processedLeads = leadsData.map((lead: any) => ({
        id: lead.id,
        nome: lead.nome || lead.name,
        telefone_lead: lead.telefone_lead || lead.telefone,
        telefone_pri: lead.telefone_pri,
        loja: lead.loja,
        status: calculateLeadStatus(lead),
        proposal_id: lead.proposal_id,
        num_tentativas: lead.num_tentativas || 0,
        ultima_atualizacao: lead.updated_at || lead.ultima_atualizacao,
        ligacao_atendida: lead.ligacao_atendida,
        status_agendado: lead.status_agendado,
        ligacao_erro: lead.ligacao_erro,
        enviado_whatsapp: lead.enviado_whatsapp,
      }));
      
      setLeads(processedLeads);
      
      // Calculate metrics
      setMetricas({
        totalLeads: processedLeads.length,
        leadsAtendidos: processedLeads.filter((l: LeadData) => l.ligacao_atendida).length,
        leadsEmFila: processedLeads.filter((l: LeadData) => l.ligacao_erro && !l.status_agendado).length,
        leadsAgendados: processedLeads.filter((l: LeadData) => l.status_agendado).length,
        mensagensEnviadas: processedLeads.filter((l: LeadData) => l.enviado_whatsapp).length,
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
    if (lead.enviado_whatsapp) return 'não agendado';
    return 'pendente';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'pendente': { label: 'pendente', variant: 'secondary' },
      'atendido': { label: 'atendido', variant: 'default' },
      'agendado': { label: 'agendado', variant: 'default' },
      'em fila': { label: 'em fila', variant: 'destructive' },
      'não agendado': { label: 'não agendado', variant: 'outline' },
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getActionIcon = (lead: LeadData) => {
    if (lead.status_agendado) {
      return <CalendarCheck className="h-4 w-4 text-primary" />;
    }
    if (lead.ligacao_erro) {
      return <X className="h-4 w-4 text-destructive" />;
    }
    if (lead.enviado_whatsapp) {
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
    return <Phone className="h-4 w-4 text-muted-foreground" />;
  };

  // Get unique lojas for filter dropdown
  const lojas = useMemo(() => {
    return [...new Set(leads.map((l) => l.loja).filter(Boolean))] as string[];
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const query = filters.search.toLowerCase();
      const matchesSearch =
        !query ||
        lead.nome?.toLowerCase().includes(query) ||
        lead.telefone_lead?.includes(query) ||
        lead.status?.includes(query);

      const matchesLoja = !filters.loja || filters.loja === '__all__' || lead.loja === filters.loja;
      const matchesStatus = !filters.status || filters.status === '__all__' || lead.status === filters.status;

      return matchesSearch && matchesLoja && matchesStatus;
    });
  }, [leads, filters]);

  // Dynamic metrics based on filtered leads
  const dynamicMetrics = useMemo(() => {
    return {
      totalLeads: filteredLeads.length,
      leadsAtendidos: filteredLeads.filter(l => l.ligacao_atendida).length,
      leadsEmFila: filteredLeads.filter(l => l.ligacao_erro && !l.status_agendado).length,
      leadsAgendados: filteredLeads.filter(l => l.status_agendado).length,
      mensagensEnviadas: filteredLeads.filter(l => l.enviado_whatsapp).length,
    };
  }, [filteredLeads]);

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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Dashboard de Ligação</h2>
            
            {/* Event Switcher */}
            {availableEvents.length > 0 && (
              <Select value={selectedEventId || ''} onValueChange={handleEventChange}>
                <SelectTrigger className="w-[250px]">
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
          </div>
          
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
        
        {selectedEvent && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
          </div>
        )}
        
        {lastAppUpdate && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {lastAppUpdate}
          </p>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, search: e.target.value }));
              setCurrentPage(1);
            }}
            placeholder="Filtrar por telefone, nome ou status..."
            className="pl-10"
          />
        </div>
        
        <Select 
          value={filters.loja || '__all__'} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, loja: value === '__all__' ? '' : value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as lojas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as lojas</SelectItem>
            {lojas.map(loja => (
              <SelectItem key={loja} value={loja}>{loja}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button 
          variant="outline" 
          onClick={() => setFilters({ search: '', loja: '', status: '' })}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dynamicMetrics.totalLeads.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dynamicMetrics.leadsAtendidos.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Em Fila
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dynamicMetrics.leadsEmFila.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dynamicMetrics.leadsAgendados.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              WhatsApp Enviados
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dynamicMetrics.mensagensEnviadas.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Proposal ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-center">Tentativas</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead className="text-center">Ações</TableHead>
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
                  <TableRow key={lead.id || index}>
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
                    <TableCell className="text-center">{lead.num_tentativas || 0}</TableCell>
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
            <div className="flex items-center justify-between px-4 py-3 border-t">
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

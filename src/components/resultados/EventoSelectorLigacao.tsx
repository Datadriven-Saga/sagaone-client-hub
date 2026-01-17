import { useState, useEffect, useMemo } from 'react';
import { Loader2, MapPin, Search, Filter, Radio, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface EventoSelectorLigacaoProps {
  onEventSelect: (eventId: string, agentPhone: string) => void;
  selectedEventId: string | null;
  agentPhone: string | null;
}

interface AgentIA {
  id: string;
  nome: string;
  telefone: string | null;
  dealer_id: string | null;
  cerebro: string | null;
}

interface EventData {
  id: string;
  nome: string;
  telefone_pri?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  marca?: string;
  dealer_id?: string;
  evt_status?: string;
}

interface Filters {
  search: string;
  cidade: string;
  estado: string;
  marca: string;
  showAtivos: boolean;
  showInativos: boolean;
}

export const EventoSelectorLigacao = ({ 
  onEventSelect, 
  selectedEventId,
  agentPhone 
}: EventoSelectorLigacaoProps) => {
  const { activeCompany } = useCompany();
  const [agents, setAgents] = useState<AgentIA[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentIA | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    cidade: '',
    estado: '',
    marca: '',
    showAtivos: true,
    showInativos: true,
  });

  // Fetch agents (Pri - Ligação type only - filter by nome containing "Ligação" or "ligacao")
  useEffect(() => {
    const fetchAgents = async () => {
      if (!activeCompany?.id) return;
      
      try {
        setLoading(true);
        
        // Get agents linked to this company via agente_empresas, filtering by nome containing "Ligação"
        const { data: agenteEmpresasData, error: aeError } = await supabase
          .from('agente_empresas')
          .select('agente_id, agentes_ia!inner(id, nome, telefone, dealer_id, cerebro, ativo)')
          .eq('empresa_id', activeCompany.id);
        
        if (aeError) {
          console.error('Error fetching agente_empresas:', aeError);
          toast.error('Erro ao carregar agentes');
          return;
        }
        
        // Filter agents that are active, have telefone, and nome contains "Ligação" or "ligacao"
        const priAgents = (agenteEmpresasData || [])
          .map((ae: any) => ae.agentes_ia)
          .filter((agent: any) => {
            if (!agent || !agent.ativo || !agent.telefone) return false;
            const nome = (agent.nome || '').toLowerCase();
            return nome.includes('ligação') || nome.includes('ligacao');
          })
          .map((agent: any) => ({
            id: agent.id,
            nome: agent.nome,
            telefone: agent.telefone,
            dealer_id: agent.dealer_id,
            cerebro: agent.cerebro,
          }));
        
        console.log('📞 Agentes Pri(Ligação) encontrados:', priAgents);
        setAgents(priAgents);
        
        // If we have agentPhone from props, try to find and select that agent
        if (agentPhone) {
          const matchingAgent = priAgents.find((a: AgentIA) => a.telefone === agentPhone);
          if (matchingAgent) {
            setSelectedAgent(matchingAgent);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Erro ao carregar agentes');
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [activeCompany?.id, agentPhone]);

  // Fetch events when agent is selected
  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedAgent?.telefone) {
        setEvents([]);
        return;
      }
      
      try {
        setLoadingEvents(true);
        
        // Use edge function para consultar eventos-pri com token SAGA_ONE
        const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
          body: { endpoint: 'eventos-pri', telefone_pri: selectedAgent.telefone },
        });
        
        if (error) {
          throw new Error('Erro ao buscar eventos');
        }
        
        const eventsArray = data?.eventos || data || [];
        
        const eventsData = eventsArray.map((e: any) => ({
          id: String(e.id_evento || e.id),
          nome: e.nome || e.name,
          telefone_pri: e.telefone_pri,
          cidade: e.cidade,
          uf: e.uf || e.estado,
          estado: e.uf || e.estado,
          marca: e.marca,
          dealer_id: e.dealer_id,
          evt_status: e.evt_status || 'ativo',
        }));
        
        setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Erro ao carregar eventos');
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedAgent]);

  // Filter options
  const filterOptions = useMemo(() => {
    const cidades = [...new Set(events.map(e => e.cidade).filter(Boolean))] as string[];
    const estados = [...new Set(events.map(e => e.estado || e.uf).filter(Boolean))] as string[];
    const marcas = [...new Set(events.map(e => e.marca).filter(Boolean))] as string[];
    return { cidades, estados, marcas };
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = !filters.search || 
        event.nome.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesCidade = !filters.cidade || filters.cidade === '__all__' || event.cidade === filters.cidade;
      const matchesEstado = !filters.estado || filters.estado === '__all__' || (event.estado || event.uf) === filters.estado;
      const matchesMarca = !filters.marca || filters.marca === '__all__' || event.marca === filters.marca;
      
      // Status filter
      const isAtivo = !event.evt_status || event.evt_status === 'ativo';
      const matchesStatus = (filters.showAtivos && isAtivo) || (filters.showInativos && !isAtivo);
      
      return matchesSearch && matchesCidade && matchesEstado && matchesMarca && matchesStatus;
    });
  }, [events, filters]);

  const handleAgentChange = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  };

  const handleEventSelect = (event: EventData) => {
    if (selectedAgent?.telefone) {
      onEventSelect(event.id, selectedAgent.telefone);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      cidade: '',
      estado: '',
      marca: '',
      showAtivos: true,
      showInativos: true,
    });
  };

  const activeFiltersCount = [
    filters.search,
    filters.cidade && filters.cidade !== '__all__' ? filters.cidade : '',
    filters.estado && filters.estado !== '__all__' ? filters.estado : '',
    filters.marca && filters.marca !== '__all__' ? filters.marca : '',
    !filters.showAtivos ? 'hideAtivos' : '',
    !filters.showInativos ? 'hideInativos' : '',
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Radio className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Nenhum Agente Disponível</h3>
        <p className="text-sm text-muted-foreground">
          Não há agentes Pri - Ligação configurados para esta empresa
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Selecionar Evento</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um agente e um evento para visualizar o dashboard de ligações
        </p>
      </div>

      {/* Agent Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-sm font-medium">Agente Pri - Ligação:</span>
        <Select value={selectedAgent?.id || ''} onValueChange={handleAgentChange}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Selecionar agente..." />
          </SelectTrigger>
          <SelectContent>
            {agents.map(agent => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.nome} {agent.telefone ? `- ${agent.telefone}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show filters only when agent is selected */}
      {selectedAgent && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Buscar evento..."
                  className="pl-10"
                />
              </div>
              
              {filterOptions.estados.length > 0 && (
                <Select 
                  value={filters.estado || '__all__'} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value === '__all__' ? '' : value }))}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos Estados</SelectItem>
                    {filterOptions.estados.map(estado => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {filterOptions.cidades.length > 0 && (
                <Select 
                  value={filters.cidade || '__all__'} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, cidade: value === '__all__' ? '' : value }))}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas Cidades</SelectItem>
                    {filterOptions.cidades.map(cidade => (
                      <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {filterOptions.marcas.length > 0 && (
                <Select 
                  value={filters.marca || '__all__'} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, marca: value === '__all__' ? '' : value }))}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas Marcas</SelectItem>
                    {filterOptions.marcas.map(marca => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Status Checkboxes and Clear Filter */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showAtivos"
                  checked={filters.showAtivos}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showAtivos: !!checked }))}
                />
                <label htmlFor="showAtivos" className="text-sm cursor-pointer">
                  Eventos Ativos
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showInativos"
                  checked={filters.showInativos}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showInativos: !!checked }))}
                />
                <label htmlFor="showInativos" className="text-sm cursor-pointer">
                  Eventos Inativos
                </label>
              </div>

              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>

          {/* Events Grid */}
          {loadingEvents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {events.length === 0 
                  ? 'Nenhum evento encontrado para este agente'
                  : 'Nenhum evento corresponde aos filtros'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((event) => {
                const isAtivo = !event.evt_status || event.evt_status === 'ativo';
                return (
                  <Card 
                    key={event.id}
                    className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                      selectedEventId === event.id ? 'border-primary ring-1 ring-primary' : ''
                    } ${!isAtivo ? 'opacity-70' : ''}`}
                    onClick={() => handleEventSelect(event)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Radio className={`h-4 w-4 ${selectedEventId === event.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          <h3 className="font-semibold">{event.nome}</h3>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant={isAtivo ? 'default' : 'secondary'} className="text-xs">
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </Badge>
                          {event.marca && (
                            <Badge variant="outline" className="text-xs">
                              {event.marca}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {(event.cidade || event.estado || event.uf) && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {event.cidade}{(event.estado || event.uf) ? `, ${event.estado || event.uf}` : ''}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          
          <p className="text-sm text-muted-foreground text-center">
            {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} encontrado{filteredEvents.length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
};

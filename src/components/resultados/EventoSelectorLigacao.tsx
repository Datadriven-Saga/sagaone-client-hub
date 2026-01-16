import { useState, useEffect, useMemo } from 'react';
import { Loader2, MapPin, Search, Filter, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
}

interface Filters {
  search: string;
  cidade: string;
  estado: string;
  marca: string;
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
  });

  // Fetch agents (Pri - Ligação type)
  useEffect(() => {
    const fetchAgents = async () => {
      if (!activeCompany?.id) return;
      
      try {
        setLoading(true);
        
        // Get agents from agentes_ia with tipo Pri - Ligação (checking dealer_id or cerebro field)
        const { data: agentesData, error } = await supabase
          .from('agentes_ia')
          .select('id, nome, telefone, dealer_id')
          .eq('ativo', true)
          .not('telefone', 'is', null);
        
        if (error) {
          console.error('Error fetching agents:', error);
          toast.error('Erro ao carregar agentes');
          return;
        }
        
        // Filter to only include agents that have a telefone (indicating Pri - Ligação)
        const priAgents = (agentesData || []).filter(a => a.telefone);
        setAgents(priAgents);
        
        // If we have agentPhone from props, try to find and select that agent
        if (agentPhone) {
          const matchingAgent = priAgents.find(a => a.telefone === agentPhone);
          if (matchingAgent) {
            setSelectedAgent(matchingAgent);
          }
        } else if (priAgents.length > 0) {
          // Auto-select first agent if none selected
          setSelectedAgent(priAgents[0]);
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
        
        const response = await fetch(
          `https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-eventos?telefone_pri=${encodeURIComponent(selectedAgent.telefone)}`
        );
        
        if (!response.ok) {
          throw new Error('Erro ao buscar eventos');
        }
        
        const data = await response.json();
        const eventsData = (data.eventos || data || []).map((e: any) => ({
          id: String(e.id_evento || e.id),
          nome: e.nome || e.name,
          telefone_pri: e.telefone_pri,
          cidade: e.cidade,
          uf: e.uf || e.estado,
          estado: e.uf || e.estado,
          marca: e.marca,
          dealer_id: e.dealer_id,
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
      
      return matchesSearch && matchesCidade && matchesEstado && matchesMarca;
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
          Escolha um evento para visualizar o dashboard de ligações
        </p>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Agente:</span>
        <Select value={selectedAgent?.id || ''} onValueChange={handleAgentChange}>
          <SelectTrigger className="w-[250px]">
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

      {/* Search and Filters */}
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {filterOptions.estados.map(estado => (
                <SelectItem key={estado} value={estado}>{estado}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Button 
          variant="outline" 
          onClick={() => setFilters({ search: '', cidade: '', estado: '', marca: '' })}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
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
          {filteredEvents.map((event) => (
            <Card 
              key={event.id}
              className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                selectedEventId === event.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => handleEventSelect(event)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className={`h-4 w-4 ${selectedEventId === event.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <h3 className="font-semibold">{event.nome}</h3>
                  </div>
                  {event.marca && (
                    <Badge variant="secondary" className="text-xs">
                      {event.marca}
                    </Badge>
                  )}
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
          ))}
        </div>
      )}
      
      <p className="text-sm text-muted-foreground text-center">
        {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} encontrado{filteredEvents.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

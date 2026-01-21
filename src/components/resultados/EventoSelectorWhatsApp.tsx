import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface EventoSelectorWhatsAppProps {
  onEventSelect: (eventId: string, eventIdPri: string) => void;
  selectedEventId: string | null;
}

interface EventData {
  id: string;
  titulo: string;
  event_id_pri: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

export const EventoSelectorWhatsApp = ({ 
  onEventSelect, 
  selectedEventId 
}: EventoSelectorWhatsAppProps) => {
  const { activeCompany } = useCompany();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch events with event_id_pri (IA WhatsApp events)
  useEffect(() => {
    const fetchEvents = async () => {
      if (!activeCompany?.id) return;

      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('prospeccoes')
          .select('id, titulo, event_id_pri, data_inicio, data_fim')
          .eq('empresa_id', activeCompany.id)
          .eq('canal', 'Whatsapp')
          .not('event_id_pri', 'is', null)
          .order('data_inicio', { ascending: false });

        if (error) {
          throw error;
        }

        console.log('📱 Eventos WhatsApp encontrados:', data);
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Erro ao carregar eventos');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [activeCompany?.id]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    
    const lowerSearch = searchTerm.toLowerCase();
    return events.filter(event => 
      event.titulo?.toLowerCase().includes(lowerSearch)
    );
  }, [events, searchTerm]);

  const handleEventSelect = (event: EventData) => {
    if (event.event_id_pri) {
      onEventSelect(event.id, event.event_id_pri);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Nenhum Evento Disponível</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Não há eventos WhatsApp configurados para esta empresa.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          Crie um evento do tipo "Whatsapp" com event_id_pri configurado.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Selecionar Evento WhatsApp
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha um evento para visualizar o dashboard de mensagens
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar evento..."
          className="pl-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum evento corresponde à busca
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            return (
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
                      <MessageSquare className={`h-4 w-4 ${selectedEventId === event.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h3 className="font-semibold line-clamp-1">{event.titulo}</h3>
                    </div>
                  </div>

                  {(event.data_inicio || event.data_fim) && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.data_inicio)}
                      {event.data_fim && ` - ${formatDate(event.data_fim)}`}
                    </p>
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
    </div>
  );
};

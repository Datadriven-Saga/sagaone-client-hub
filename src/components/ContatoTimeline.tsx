import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowRightLeft, MessageSquareText, MessageCircle, UserCheck, 
  FileText, Lock, Unlock, Trophy, Clock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelineEvent {
  id: string;
  tipo: string;
  descricao: string;
  metadata: Record<string, unknown> | null;
  usuario_nome: string;
  created_at: string;
}

const TIPO_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  status_change:        { icon: ArrowRightLeft, color: 'text-blue-500 bg-blue-500/10',       label: 'Mudança de Status' },
  anotacao:             { icon: MessageSquareText, color: 'text-amber-500 bg-amber-500/10',  label: 'Anotação' },
  whatsapp_enviado:     { icon: MessageCircle, color: 'text-green-500 bg-green-500/10',      label: 'WhatsApp' },
  responsavel_atribuido:{ icon: UserCheck, color: 'text-purple-500 bg-purple-500/10',        label: 'Responsável' },
  proposta_atualizada:  { icon: FileText, color: 'text-indigo-500 bg-indigo-500/10',         label: 'Proposta' },
  quarentena_entrada:   { icon: Lock, color: 'text-red-500 bg-red-500/10',                   label: 'Quarentena' },
  quarentena_saida:     { icon: Unlock, color: 'text-emerald-500 bg-emerald-500/10',         label: 'Quarentena' },
  venda:                { icon: Trophy, color: 'text-yellow-500 bg-yellow-500/10',           label: 'Venda' },
};

const DEFAULT_CONFIG = { icon: Clock, color: 'text-muted-foreground bg-muted', label: 'Evento' };
const PAGE_SIZE = 20;

interface ContatoTimelineProps {
  contatoId: string;
}

export function ContatoTimeline({ contatoId }: ContatoTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);

    const { data, error } = await supabase.rpc('get_contato_timeline', {
      p_contato_id: contatoId,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });

    if (!error && data) {
      const typed = data as unknown as TimelineEvent[];
      setEvents(prev => append ? [...prev, ...typed] : typed);
      setHasMore(typed.length === PAGE_SIZE);
    }

    if (append) setLoadingMore(false); else setLoading(false);
  }, [contatoId]);

  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    fetchEvents(0, false);
  }, [contatoId, fetchEvents]);

  const loadMore = () => fetchEvents(events.length, true);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Nenhum evento registrado ainda.</p>
        <p className="text-xs mt-1">O histórico será preenchido automaticamente a partir de agora.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {events.map((event) => {
            const config = TIPO_CONFIG[event.tipo] || DEFAULT_CONFIG;
            const Icon = config.icon;
            const createdAt = new Date(event.created_at);

            return (
              <div key={event.id} className="relative flex gap-3">
                {/* Icon dot */}
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm leading-snug">{event.descricao}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>por {event.usuario_nome}</span>
                    <span>•</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default">
                          {formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

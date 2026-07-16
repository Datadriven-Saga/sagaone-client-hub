import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanItem } from './KanbanBoard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Phone, PhoneCall, MessageCircle, ArrowRightCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneForDisplay, normalizePhoneForComparison } from '@/lib/phoneUtils';
import { useUserAccessType } from '@/hooks/useUserAccessType';

interface KanbanCardProps {
  item: KanbanItem;
  isDragging?: boolean;
  onCardClick?: (item: KanbanItem) => void;
  currentColumnId?: string;
  availableColumns?: { id: string; title: string }[];
  onMoveItem?: (itemId: string, targetColumnId: string) => void | Promise<void>;
}

const ORIGIN_STYLES: Record<string, string> = {
  'whatsapp': 'bg-green-50 text-green-700 border-green-200',
  'instagram': 'bg-pink-50 text-pink-700 border-pink-200',
  'facebook': 'bg-blue-50 text-blue-700 border-blue-200',
  'google': 'bg-red-50 text-red-700 border-red-200',
  'site': 'bg-purple-50 text-purple-700 border-purple-200',
  'indicação': 'bg-amber-50 text-amber-700 border-amber-200',
  'telefone': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'email': 'bg-teal-50 text-teal-700 border-teal-200',
  'webhook': 'bg-gray-50 text-gray-700 border-gray-200',
  'outros': 'bg-slate-50 text-slate-700 border-slate-200',
};

export function KanbanCard({ item, isDragging, onCardClick, currentColumnId, availableColumns, onMoveItem }: KanbanCardProps) {
  const { isSDR } = useUserAccessType();
  const [callInitiated, setCallInitiated] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [localTentativas, setLocalTentativas] = useState(item.tentativas_chamada ?? 0);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const awaitingReturnRef = useRef(false);

  // Sync with prop when parent re-fetches
  useEffect(() => {
    setLocalTentativas(item.tentativas_chamada ?? 0);
  }, [item.tentativas_chamada]);

  // Reset call state when the card is recycled to a different item
  useEffect(() => {
    setCallInitiated(false);
    setPopoverOpen(false);
    setShowCallConfirm(false);
    awaitingReturnRef.current = false;
  }, [item.id]);

  // Pós-retorno do discador: pergunta se ligação aconteceu e conta tentativa.
  useEffect(() => {
    const handleReturn = () => {
      if (!awaitingReturnRef.current) return;
      if (document.visibilityState !== 'visible') return;
      awaitingReturnRef.current = false;
      // pequeno delay pra evitar disparar antes do foco voltar de fato
      setTimeout(() => setShowCallConfirm(true), 250);
    };
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('pageshow', handleReturn);
    return () => {
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('pageshow', handleReturn);
    };
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return `há ${formatDistanceToNow(new Date(dateString), { locale: ptBR })}`;
    } catch {
      return null;
    }
  };

  const getOriginStyle = (origin?: string) => {
    const key = origin?.toLowerCase() || 'outros';
    return ORIGIN_STYLES[key] || ORIGIN_STYLES['outros'];
  };

  const shortId = `#${item.id.slice(0, 8).toUpperCase()}`;
  const displayId = item.lead_id != null ? `#${item.lead_id}` : shortId;
  const origin = item.tags?.[0];
  const timeAgo = formatTime(item.dueDate);

  const isBeingDragged = isDragging || isSortableDragging;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // E.164 BR: +55 + DDD + 9 + 8 dígitos — usado pelo <a href="tel:">
  const telHref = (() => {
    const normalized = normalizePhoneForComparison(item.channel || '');
    const phone = normalized || (item.channel?.replace(/\D/g, '') || '');
    return `tel:+55${phone}`;
  })();

  const formatPhoneForWhatsApp = (channel?: string | null): string | null => {
    const normalized = normalizePhoneForComparison(channel || '');
    if (normalized) return `55${normalized}`;
    const digits = (channel || '').replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    if (digits.length === 12 || digits.length === 13) return digits;
    return null;
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = formatPhoneForWhatsApp(item.channel);
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const handleConfirmSim = async () => {
    if (isBusy) return;
    setIsBusy(true);
    const prev = localTentativas;
    setLocalTentativas(prev + 1); // Optimistic
    try {
      const { error } = await supabase.rpc('increment_tentativas_chamada', {
        p_contato_id: item.id,
      });
      if (error) throw error;
      toast.success('Tentativa registrada');
      setShowCallConfirm(false);
    } catch (err) {
      console.error('Erro ao registrar tentativa:', err);
      setLocalTentativas(prev);
      toast.error('Erro ao registrar tentativa de ligação');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmNao = () => {
    // Não conta tentativa. Apenas fecha o diálogo pós-retorno.
    setShowCallConfirm(false);
  };

  const handlePickDestination = async (targetColumnId: string) => {
    if (!onMoveItem || isBusy) return;
    setIsBusy(true);
    try {
      await onMoveItem(item.id, targetColumnId);
      setPopoverOpen(false);
      setCallInitiated(false);
    } catch (err) {
      console.error('Erro ao mover lead:', err);
      toast.error('Erro ao mover lead');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCloseWithoutMove = () => {
    setPopoverOpen(false);
    setCallInitiated(false);
  };

  // Destinos fixos: Em Espera, Convidados, Confirmados
  const DESTINATIONS: Array<{ id: string; label: string }> = [
    { id: 'emespera', label: 'Em Espera' },
    { id: 'convidados', label: 'Convidados' },
    { id: 'confirmados', label: 'Confirmados' },
  ];
  const availableIds = new Set((availableColumns ?? []).map(c => c.id));
  const visibleDestinations = DESTINATIONS.filter(
    d => availableIds.has(d.id) && d.id !== currentColumnId
  );

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onCardClick?.(item)}
        className={cn(
          "bg-white border border-border rounded-lg p-3.5 cursor-grab active:cursor-grabbing",
          "hover:shadow-md hover:border-border/80 transition-all duration-150",
          isBeingDragged && "shadow-xl scale-[1.02] rotate-1 opacity-90 border-primary/40"
        )}
      >
        {/* Header: Name + ID */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <h4
              className="text-sm font-medium text-foreground leading-snug line-clamp-2"
              title={item.title}
            >
              {item.title}
            </h4>
            {localTentativas > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shrink-0">
                    <PhoneCall className="w-3 h-3" />
                    {localTentativas}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{localTentativas} tentativa(s) de ligação</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {displayId}
          </span>
        </div>

        {/* Phone */}
        {item.channel && (
          <div className="flex items-center gap-2 mb-2.5">
            <p className="text-sm text-muted-foreground">
              {formatPhoneForDisplay(item.channel) || item.channel}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={telHref}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Deixa o SO abrir o discador via href; habilita o botão inline de movimentação
                    // e arma o listener pós-retorno para perguntar sobre a tentativa.
                    setCallInitiated(true);
                    awaitingReturnRef.current = true;
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors shrink-0"
                  aria-label="Ligar para o lead"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ligar para o lead</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleWhatsAppClick}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors shrink-0"
                  aria-label="Abrir WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Abrir WhatsApp</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Origin + Responsável + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {origin && !isSDR && (
              <span 
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border",
                  getOriginStyle(origin)
                )}
              >
                {origin.toLowerCase()}
              </span>
            )}
            <Popover
              open={popoverOpen}
              onOpenChange={(open) => {
                if (isBusy) return;
                setPopoverOpen(open);
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!callInitiated}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!callInitiated) return;
                        setPopoverOpen((v) => !v);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
                        callInitiated
                          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          : "bg-muted text-muted-foreground border-border opacity-60 cursor-not-allowed"
                      )}
                      aria-label="Mover lead"
                    >
                      <ArrowRightCircle className="w-3 h-3" />
                      Mover lead
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                {!callInitiated && (
                  <TooltipContent>
                    <p>Clique em ligar antes de mover o lead</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <PopoverContent
                className="w-64 p-3"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="space-y-2">
                    <p className="text-sm font-medium">Mover lead para…</p>
                    {visibleDestinations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sem destinos disponíveis nesta visão.
                      </p>
                    ) : (
                      <div className="grid gap-1.5">
                        {visibleDestinations.map((d) => (
                          <Button
                            key={d.id}
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handlePickDestination(d.id)}
                            className="justify-start"
                          >
                            {d.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={handleCloseWithoutMove}
                        className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Fechar sem mover
                      </button>
                    </div>
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className={cn(
                    "flex items-center justify-center text-[10px] font-semibold w-6 h-6 rounded-full cursor-default",
                    item.assignee 
                      ? "bg-green-100 text-green-700 border border-green-200" 
                      : "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {item.assignee ? getInitials(item.assignee) : "--"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{item.assignee || "Sem responsável"}</p>
              </TooltipContent>
            </Tooltip>
            {item.temperatura && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: item.temperatura.cor }}
                    aria-label={`Temperatura: ${item.temperatura.nome}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Temperatura: {item.temperatura.nome}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {timeAgo && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              {timeAgo}
            </span>
          )}
        </div>
      </div>
      <AlertDialog
        open={showCallConfirm}
        onOpenChange={(open) => {
          if (!open && !isBusy) setShowCallConfirm(false);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Você realizou a ligação?</AlertDialogTitle>
            <AlertDialogDescription>
              Contato: <strong>{item.title}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy} onClick={handleConfirmNao}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={handleConfirmSim}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

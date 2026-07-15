import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanItem } from './KanbanBoard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Phone, PhoneCall, MessageCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneForDisplay, normalizePhoneForComparison } from '@/lib/phoneUtils';

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
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [pendingCallConfirmation, setPendingCallConfirmation] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [localTentativas, setLocalTentativas] = useState(item.tentativas_chamada ?? 0);
  const callStartedAtRef = useRef<number | null>(null);

  // Sync with prop when parent re-fetches
  useEffect(() => {
    setLocalTentativas(item.tentativas_chamada ?? 0);
  }, [item.tentativas_chamada]);

  useEffect(() => {
    if (!pendingCallConfirmation) return;

    const showConfirmationAfterReturn = () => {
      if (document.visibilityState === 'hidden') return;

      const elapsed = Date.now() - (callStartedAtRef.current ?? 0);
      if (elapsed < 800) return;

      setPendingCallConfirmation(false);
      setShowCallConfirm(true);
    };

    window.addEventListener('focus', showConfirmationAfterReturn);
    window.addEventListener('pageshow', showConfirmationAfterReturn);
    document.addEventListener('visibilitychange', showConfirmationAfterReturn);

    return () => {
      window.removeEventListener('focus', showConfirmationAfterReturn);
      window.removeEventListener('pageshow', showConfirmationAfterReturn);
      document.removeEventListener('visibilitychange', showConfirmationAfterReturn);
    };
  }, [pendingCallConfirmation]);

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

  const handleConfirmCall = async () => {
    setShowCallConfirm(false);
    const newCount = localTentativas + 1;
    setLocalTentativas(newCount); // Optimistic update
    try {
      const { error } = await supabase.rpc('increment_tentativas_chamada', {
        p_contato_id: item.id,
      });
      if (error) throw error;
      toast.success('Tentativa de ligação registrada!');
      // Offer to move the lead to another Kanban column right away.
      if (onMoveItem && availableColumns && availableColumns.length > 1) {
        setShowMovePicker(true);
      }
    } catch (err) {
      console.error('Erro ao registrar tentativa:', err);
      setLocalTentativas(localTentativas); // Revert on error
      toast.error('Erro ao registrar tentativa de ligação');
    }
  };

  const handlePickColumn = async (targetColumnId: string) => {
    if (!onMoveItem) return;
    setIsMoving(true);
    try {
      await onMoveItem(item.id, targetColumnId);
      setShowMovePicker(false);
    } finally {
      setIsMoving(false);
    }
  };

  const moveTargets = (availableColumns ?? []).filter(c => c.id !== currentColumnId);

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
            <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
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
                    // Deixa o SO abrir o discador via href; a confirmação aparece só ao voltar ao sistema.
                    callStartedAtRef.current = Date.now();
                    setPendingCallConfirmation(true);
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
            {origin && (
              <span 
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border",
                  getOriginStyle(origin)
                )}
              >
                {origin.toLowerCase()}
              </span>
            )}
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

      <AlertDialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você realizou a ligação?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme se a ligação para <strong>{item.title}</strong> foi realizada para registrar a tentativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCall}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showMovePicker} onOpenChange={(open) => !isMoving && setShowMovePicker(open)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Mover lead para outra etapa?</DialogTitle>
            <DialogDescription>
              Escolha a etapa do Kanban para onde <strong>{item.title}</strong> deve ir. Se preferir só registrar a ligação, feche sem mover.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {moveTargets.map(col => (
              <Button
                key={col.id}
                variant="outline"
                size="sm"
                disabled={isMoving}
                onClick={() => handlePickColumn(col.id)}
                className="justify-start"
              >
                {col.title}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={isMoving} onClick={() => setShowMovePicker(false)}>
              Fechar sem mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

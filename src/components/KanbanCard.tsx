import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanItem } from './KanbanBoard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Phone, PhoneCall } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneForDisplay, normalizePhoneForComparison } from '@/lib/phoneUtils';

interface KanbanCardProps {
  item: KanbanItem;
  isDragging?: boolean;
  onCardClick?: (item: KanbanItem) => void;
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

export function KanbanCard({ item, isDragging, onCardClick }: KanbanCardProps) {
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [localTentativas, setLocalTentativas] = useState(item.tentativas_chamada ?? 0);

  // Sync with prop when parent re-fetches
  useEffect(() => {
    setLocalTentativas(item.tentativas_chamada ?? 0);
  }, [item.tentativas_chamada]);

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

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open native dialer (E.164 BR: +55 + DDD + 9 + 8 dígitos)
    const normalized = normalizePhoneForComparison(item.channel || '');
    const phone = normalized || (item.channel?.replace(/\D/g, '') || '');
    window.open(`tel:+55${phone}`, '_self');
    // Show confirmation dialog
    setShowCallConfirm(true);
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
    } catch (err) {
      console.error('Erro ao registrar tentativa:', err);
      setLocalTentativas(localTentativas); // Revert on error
      toast.error('Erro ao registrar tentativa de ligação');
    }
  };

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
            {(
              <button
                onClick={handlePhoneClick}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors shrink-0"
                aria-label="Ligar para o lead"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}
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
    </>
  );
}

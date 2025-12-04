import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanItem } from './KanbanBoard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const origin = item.tags?.[0];
  const timeAgo = formatTime(item.dueDate);

  const isBeingDragged = isDragging || isSortableDragging;

  return (
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
        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {item.title}
        </h4>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
          {shortId}
        </span>
      </div>

      {/* Phone */}
      {item.channel && (
        <p className="text-sm text-muted-foreground mb-2.5">
          {item.channel}
        </p>
      )}

      {/* Origin + Time */}
      <div className="flex items-center justify-between gap-2">
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
        {timeAgo && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {timeAgo}
          </span>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-muted-foreground mt-2.5 pt-2.5 border-t border-border/50 line-clamp-2">
          {item.description}
        </p>
      )}
    </div>
  );
}

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { KanbanItem } from './KanbanBoard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanCardProps {
  item: KanbanItem;
  isDragging?: boolean;
  onCardClick?: (item: KanbanItem) => void;
}

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
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const getOrigemBadgeStyle = (origem?: string) => {
    switch (origem?.toLowerCase()) {
      case 'whatsapp':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'instagram':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'facebook':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'google':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'site':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'indicação':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'telefone':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'webhook':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: false, locale: ptBR });
    } catch {
      return null;
    }
  };

  const getIdShort = (id: string) => {
    return `#${id.slice(0, 8).toUpperCase()}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-background border border-border rounded-lg p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        isDragging ? 'rotate-2 shadow-lg scale-105' : ''
      }`}
      onClick={() => onCardClick?.(item)}
    >
      <div className="space-y-2">
        {/* Nome e ID */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground leading-tight">
            {item.title}
          </h4>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono shrink-0">
            {getIdShort(item.id)}
          </Badge>
        </div>

        {/* Telefone */}
        {item.channel && (
          <p className="text-sm text-muted-foreground">
            {item.channel}
          </p>
        )}

        {/* Origem e Tempo */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {item.tags && item.tags[0] && (
              <Badge 
                variant="outline" 
                className={`text-[10px] px-2 py-0.5 font-normal ${getOrigemBadgeStyle(item.tags[0])}`}
              >
                {item.tags[0].toLowerCase()}
              </Badge>
            )}
          </div>
          {item.dueDate && (
            <span className="text-xs text-muted-foreground">
              há {formatRelativeTime(item.dueDate)}
            </span>
          )}
        </div>

        {/* Descrição/Observação */}
        {item.description && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

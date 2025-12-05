import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnData, KanbanItem } from './KanbanBoard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface KanbanColumnProps {
  column: KanbanColumnData;
  onCardClick?: (item: KanbanItem) => void;
  onSolicitarClientes?: () => void;
}

const COLUMN_COLORS: Record<string, string> = {
  'novos': 'bg-blue-500',
  'atribuidos': 'bg-indigo-500',
  'emespera': 'bg-amber-500',
  'convidados': 'bg-violet-500',
  'agendados': 'bg-purple-500',
  'confirmados': 'bg-emerald-500',
  'checkin': 'bg-green-500',
  'descartados': 'bg-red-500',
  'optout': 'bg-gray-500',
  'desperdicio': 'bg-rose-500',
};

export function KanbanColumn({ column, onCardClick, onSolicitarClientes }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const badgeColor = COLUMN_COLORS[column.id] || 'bg-primary';

  return (
    <div 
      className={cn(
        "w-72 flex-shrink-0 flex flex-col rounded-xl border border-border bg-muted/30 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {column.title}
          </h3>
          <span 
            className={cn(
              "text-xs font-medium text-white px-2 py-0.5 rounded-full min-w-[24px] text-center",
              badgeColor
            )}
          >
            {column.items.length}
          </span>
        </div>
        {onSolicitarClientes && (
          <Button
            onClick={onSolicitarClientes}
            variant="outline"
            size="sm"
            className="text-xs h-6 px-2"
          >
            Solicitar
          </Button>
        )}
      </div>

      {/* Cards Container */}
      <div 
        ref={setNodeRef}
        className="flex-1 p-1.5 space-y-1.5 overflow-y-auto min-h-[80px] max-h-[calc(100vh-280px)]"
      >
        {column.items.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Nenhum lead nesta etapa
          </div>
        ) : (
          column.items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              onCardClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

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
  'novos': 'bg-red-500',         // #EF4444 - Total da Base
  'atribuidos': 'bg-orange-500', // #F97316 - Distribuídos
  'emespera': 'bg-orange-500',   // #F97316 - Distribuídos
  'convidados': 'bg-lime-500',   // #84CC16 - Convidados
  'confirmados': 'bg-green-500', // #22C55E - Confirmados
  'checkin': 'bg-green-600',     // #16A34A - Check-ins
  'venda': 'bg-blue-500',        // #3B82F6 - Vendas
  'descartados': 'bg-gray-400',  // Cinza
  'optout': 'bg-gray-600',       // Cinza escuro
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
        "min-w-[280px] flex-1 max-w-[320px] flex-shrink-0 flex flex-col h-full rounded-xl border border-border bg-muted/30 transition-colors",
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
        className="flex-1 p-1.5 space-y-1.5 overflow-y-auto min-h-[80px]"
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

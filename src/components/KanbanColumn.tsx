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
  'novos': '#FF8F6B',         // Total da Base
  'atribuidos': '#FFC327',    // Distribuídos
  'emespera': '#FFC327',      // Distribuídos
  'convidados': '#2EC65C',    // Convidados
  'confirmados': '#5B93FF',   // Confirmados
  'checkin': '#605BFF',       // Check-ins
  'venda': '#4830E4',         // Vendas
  'descartados': '#A3A3A3',   // Cinza
  'optout': '#4B5563',        // Cinza escuro
  'desperdicio': '#F43F5E',
};

export function KanbanColumn({ column, onCardClick, onSolicitarClientes }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const badgeColor = COLUMN_COLORS[column.id] || '#04bbda';

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
            className="text-xs font-medium text-white px-2 py-0.5 rounded-full min-w-[24px] text-center"
            style={{ backgroundColor: badgeColor }}
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

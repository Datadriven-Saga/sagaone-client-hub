import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnData, KanbanItem } from './KanbanBoard';

interface KanbanColumnProps {
  column: KanbanColumnData;
  onCardClick?: (item: KanbanItem) => void;
}

export function KanbanColumn({ column, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const getColumnBadgeColor = (columnId: string) => {
    switch (columnId.toLowerCase()) {
      case 'novo':
        return 'bg-blue-500';
      case 'em contato':
      case 'em_contato':
        return 'bg-yellow-500';
      case 'qualificado':
        return 'bg-green-500';
      case 'proposta':
        return 'bg-purple-500';
      case 'negociação':
      case 'negociacao':
        return 'bg-orange-500';
      case 'fechado':
        return 'bg-emerald-600';
      case 'perdido':
        return 'bg-red-500';
      case 'atribuído':
      case 'atribuido':
        return 'bg-indigo-500';
      case 'convidado':
        return 'bg-cyan-500';
      case 'agendado':
        return 'bg-teal-500';
      case 'confirmado':
        return 'bg-lime-500';
      case 'check-in':
        return 'bg-emerald-500';
      case 'descartado':
        return 'bg-gray-500';
      case 'desperdício':
      case 'desperdicio':
        return 'bg-rose-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="w-72 bg-muted/40 border border-border rounded-lg flex flex-col min-h-[400px] max-h-[calc(100vh-280px)]">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {column.title}
          </h3>
          <span 
            className={`${getColumnBadgeColor(column.id)} text-white text-xs font-medium px-2.5 py-0.5 rounded-full min-w-[24px] text-center`}
          >
            {column.items.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div 
        ref={setNodeRef}
        className="flex-1 p-3 space-y-3 overflow-y-auto"
      >
        {column.items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
            <p className="text-sm text-muted-foreground">
              Nenhum lead nesta etapa
            </p>
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

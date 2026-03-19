import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnData, KanbanItem } from './KanbanBoard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KanbanColumnProps {
  column: KanbanColumnData;
  totalCount?: number; // Real total from DB, independent of loaded items
  onCardClick?: (item: KanbanItem) => void;
  onSolicitarClientes?: () => void;
  solicitarDisabled?: boolean;
  solicitarTooltip?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
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

export function KanbanColumn({ column, totalCount, onCardClick, onSolicitarClientes, solicitarDisabled, solicitarTooltip, onLoadMore, hasMore, loadingMore }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const badgeColor = COLUMN_COLORS[column.id] || '#04bbda';
  const displayCount = totalCount ?? column.items.length;

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
            {displayCount}
          </span>
        </div>
        {onSolicitarClientes && (
          solicitarDisabled && solicitarTooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={onSolicitarClientes}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 px-2"
                      disabled
                    >
                      Solicitar
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">{solicitarTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={onSolicitarClientes}
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2"
            >
              Solicitar
            </Button>
          )
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
          <>
            {column.items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onCardClick={onCardClick}
              />
            ))}
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50 disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : `Carregar mais (${column.items.length} de ${displayCount})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

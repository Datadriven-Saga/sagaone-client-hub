import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export interface KanbanItem {
  id: string;
  prospeccao_id?: string;
  prospeccaoId?: string;
  lead_id?: number;
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
  channel?: string;
  prospeccaoNome?: string;
  prospeccaoCanal?: 'Whatsapp' | 'Ligação';
  segmentacao?: string;
  tentativas_chamada?: number;
  temperatura?: {
    id: string;
    nome: string;
    cor: string;
  };
}

export interface KanbanColumnData {
  id: string;
  title: string;
  items: KanbanItem[];
  color?: string;
  limit?: number;
}

interface KanbanBoardProps {
  columns: KanbanColumnData[];
  columnCounts?: Record<string, number>; // Real DB counts per column id
  onUpdateColumns: (columns: KanbanColumnData[]) => void;
  onCardClick?: (item: KanbanItem) => void;
  onStatusChange?: (itemId: string, fromStatus: string, toStatus: string, item?: KanbanItem) => Promise<boolean> | void;
  onSolicitarClientes?: () => void;
  solicitarDisabled?: boolean;
  solicitarTooltip?: string;
  onLoadMore?: (columnId: string) => void;
  columnHasMore?: Record<string, boolean>;
  columnLoadingMore?: Record<string, boolean>;
}

export function KanbanBoard({ 
  columns, 
  columnCounts,
  onUpdateColumns, 
  onCardClick,
  onStatusChange,
  onSolicitarClientes,
  solicitarDisabled,
  solicitarTooltip,
  onLoadMore,
  columnHasMore,
  columnLoadingMore,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = columns
      .flatMap(col => col.items)
      .find(item => item.id === event.active.id);
    setActiveItem(item || null);
  }, [columns]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveItem(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      setActiveItem(null);
      return;
    }

    const sourceColumn = columns.find(col => 
      col.items.some(item => item.id === activeId)
    );
    const sourceItem = sourceColumn?.items.find(item => item.id === activeId);

    if (!sourceColumn || !sourceItem) {
      setActiveItem(null);
      return;
    }

    let targetColumn = columns.find(col => col.id === overId);
    if (!targetColumn) {
      targetColumn = columns.find(col => 
        col.items.some(item => item.id === overId)
      );
    }

    if (!targetColumn) {
      setActiveItem(null);
      return;
    }

    if (sourceColumn.id === targetColumn.id) {
      const sourceIndex = sourceColumn.items.findIndex(item => item.id === activeId);
      const targetIndex = targetColumn.items.findIndex(item => item.id === overId);
      
      if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
        const newItems = [...sourceColumn.items];
        const [removed] = newItems.splice(sourceIndex, 1);
        newItems.splice(targetIndex, 0, removed);
        
        const newColumns = columns.map(col => 
          col.id === sourceColumn.id 
            ? { ...col, items: newItems }
            : col
        );
        
        onUpdateColumns(newColumns);
      }
    } else {
      // Call onStatusChange and check if it returns false (meaning we should NOT move the card)
      const result = await onStatusChange?.(activeId, sourceColumn.id, targetColumn.id, sourceItem);
      
      // If result is false, don't move the card visually
      if (result === false) {
        setActiveItem(null);
        return;
      }
      
      const newColumns = columns.map(col => {
        if (col.id === sourceColumn.id) {
          return {
            ...col,
            items: col.items.filter(item => item.id !== activeId)
          };
        } else if (col.id === targetColumn!.id) {
          const targetIndex = col.items.findIndex(item => item.id === overId);
          const newItems = [...col.items];
          
          if (targetIndex >= 0) {
            newItems.splice(targetIndex, 0, sourceItem);
          } else {
            newItems.push(sourceItem);
          }
          
          return { ...col, items: newItems };
        }
        return col;
      });

      onUpdateColumns(newColumns);
    }
    
    setActiveItem(null);
  }, [columns, onUpdateColumns, onStatusChange]);

  // Move an item programmatically (used by the "contato realizado" quick-move flow).
  // Mirrors the drag-end logic: calls onStatusChange, respects its false return, then updates columns.
  const moveItem = useCallback(async (itemId: string, targetColumnId: string) => {
    const sourceColumn = columns.find(col => col.items.some(i => i.id === itemId));
    const sourceItem = sourceColumn?.items.find(i => i.id === itemId);
    const targetColumn = columns.find(col => col.id === targetColumnId);
    if (!sourceColumn || !sourceItem || !targetColumn || sourceColumn.id === targetColumn.id) return;

    const result = await onStatusChange?.(itemId, sourceColumn.id, targetColumn.id, sourceItem);
    if (result === false) return;

    const newColumns = columns.map(col => {
      if (col.id === sourceColumn.id) {
        return { ...col, items: col.items.filter(i => i.id !== itemId) };
      }
      if (col.id === targetColumn.id) {
        return { ...col, items: [sourceItem, ...col.items] };
      }
      return col;
    });
    onUpdateColumns(newColumns);
  }, [columns, onUpdateColumns, onStatusChange]);

  const columnMeta = columns.map(c => ({ id: c.id, title: c.title }));

  // Mobile: chip nav sincronizada com o scroll horizontal via IntersectionObserver.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeColId, setActiveColId] = useState<string | null>(columns[0]?.id ?? null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const els = columns
      .map(c => scroller.querySelector<HTMLElement>(`[data-kanban-col="${c.id}"]`))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute('data-kanban-col');
        if (id) setActiveColId(id);
      },
      { root: scroller, threshold: [0.4, 0.6, 0.8] }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [columns]);

  const scrollToColumn = (id: string) => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>(`[data-kanban-col="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Chip nav (mobile only) — permite pular entre etapas sem depender de drag */}
      <div className="md:hidden sticky top-0 z-10 -mx-0.5 mb-1 flex gap-1.5 overflow-x-auto scrollbar-thin bg-background/95 backdrop-blur px-0.5 py-1.5">
        {columns.map(col => {
          const count = columnCounts?.[col.id] ?? col.items.length;
          const isActive = activeColId === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => scrollToColumn(col.id)}
              className={
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted')
              }
            >
              {col.title}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Paginação por pontos (mobile only) — reforço visual da posição atual */}
      {columns.length > 1 && (
        <div
          className="md:hidden flex justify-center items-center gap-1.5 mb-1.5"
          role="tablist"
          aria-label="Navegar entre colunas do kanban"
        >
          {columns.map(col => {
            const isActive = activeColId === col.id;
            return (
              <button
                key={col.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ir para ${col.title}`}
                onClick={() => scrollToColumn(col.id)}
                className={
                  'rounded-full transition-all ' +
                  (isActive
                    ? 'h-2 w-6 bg-primary'
                    : 'h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50')
                }
              />
            );
          })}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="h-full w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin snap-x snap-mandatory md:snap-none"
      >
        <div className="flex gap-2 p-0.5 min-w-max w-full h-full">
          {columns.map((column) => (
            <SortableContext
              key={column.id}
              items={column.items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                column={column}
                totalCount={columnCounts?.[column.id]}
                onCardClick={onCardClick}
                onSolicitarClientes={column.id === 'novos' ? onSolicitarClientes : undefined}
                solicitarDisabled={column.id === 'novos' ? solicitarDisabled : undefined}
                solicitarTooltip={column.id === 'novos' ? solicitarTooltip : undefined}
                onLoadMore={() => onLoadMore?.(column.id)}
                hasMore={columnHasMore?.[column.id]}
                loadingMore={columnLoadingMore?.[column.id]}
                availableColumns={columnMeta}
                onMoveItem={moveItem}
              />
            </SortableContext>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
        {activeItem && (
          <KanbanCard item={activeItem} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}

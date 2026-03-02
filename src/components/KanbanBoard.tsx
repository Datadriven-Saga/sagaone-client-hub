import React, { useState, useCallback } from 'react';
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
  onStatusChange?: (itemId: string, fromStatus: string, toStatus: string) => Promise<boolean> | void;
  onSolicitarClientes?: () => void;
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
      const result = await onStatusChange?.(activeId, sourceColumn.id, targetColumn.id);
      
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin">
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
                onLoadMore={() => onLoadMore?.(column.id)}
                hasMore={columnHasMore?.[column.id]}
                loadingMore={columnLoadingMore?.[column.id]}
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

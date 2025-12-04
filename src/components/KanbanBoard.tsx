import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export interface KanbanItem {
  id: string;
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
  onUpdateColumns: (columns: KanbanColumnData[]) => void;
  onAddItem?: (columnId: string, item: Omit<KanbanItem, 'id'>) => void;
  onEditItem?: (item: KanbanItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onCardClick?: (item: KanbanItem) => void;
  onStatusChange?: (itemId: string, fromStatus: string, toStatus: string) => void;
}

export function KanbanBoard({ 
  columns, 
  onUpdateColumns, 
  onCardClick,
  onStatusChange
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    
    const item = columns
      .flatMap(col => col.items)
      .find(item => item.id === event.active.id);
    
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveItem(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      setActiveId(null);
      setActiveItem(null);
      return;
    }

    const sourceColumn = columns.find(col => 
      col.items.some(item => item.id === activeId)
    );
    const sourceItem = sourceColumn?.items.find(item => item.id === activeId);

    if (!sourceColumn || !sourceItem) {
      setActiveId(null);
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
      setActiveId(null);
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
      if (onStatusChange) {
        onStatusChange(activeId, sourceColumn.id, targetColumn.id);
      }
      
      const newColumns = columns.map(col => {
        if (col.id === sourceColumn.id) {
          return {
            ...col,
            items: col.items.filter(item => item.id !== activeId)
          };
        } else if (col.id === targetColumn.id) {
          const targetIndex = col.items.findIndex(item => item.id === overId);
          const newItems = [...col.items];
          
          if (targetIndex >= 0) {
            newItems.splice(targetIndex, 0, sourceItem);
          } else {
            newItems.push(sourceItem);
          }
          
          return {
            ...col,
            items: newItems
          };
        }
        return col;
      });

      onUpdateColumns(newColumns);
    }
    
    setActiveId(null);
    setActiveItem(null);
  };

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {columns.map((column) => (
              <SortableContext
                key={column.id}
                items={column.items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <KanbanColumn
                  column={column}
                  onCardClick={onCardClick}
                />
              </SortableContext>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <KanbanCard item={activeItem} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

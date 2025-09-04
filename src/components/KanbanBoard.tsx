
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

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
  onAddItem, 
  onEditItem, 
  onDeleteItem,
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
    
    // Find the active item
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

    // Se soltar no mesmo elemento, não fazer nada
    if (activeId === overId) {
      setActiveId(null);
      setActiveItem(null);
      return;
    }

    // Find source column and item
    const sourceColumn = columns.find(col => 
      col.items.some(item => item.id === activeId)
    );
    const sourceItem = sourceColumn?.items.find(item => item.id === activeId);

    if (!sourceColumn || !sourceItem) {
      setActiveId(null);
      setActiveItem(null);
      return;
    }

    // Determine target column
    let targetColumn = columns.find(col => col.id === overId);
    if (!targetColumn) {
      // If dropped on an item, find its column
      targetColumn = columns.find(col => 
        col.items.some(item => item.id === overId)
      );
    }

    if (!targetColumn) {
      setActiveId(null);
      setActiveItem(null);
      return;
    }

    // Se mover dentro da mesma coluna, apenas reordenar
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
      // Mover entre colunas diferentes - registrar log
      if (onStatusChange) {
        onStatusChange(activeId, sourceColumn.id, targetColumn.id);
      }
      
      const newColumns = columns.map(col => {
        if (col.id === sourceColumn.id) {
          // Remove item from source column
          return {
            ...col,
            items: col.items.filter(item => item.id !== activeId)
          };
        } else if (col.id === targetColumn.id) {
          // Add item to target column
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

  const handleAddColumn = () => {
    const newColumn: KanbanColumnData = {
      id: `column-${Date.now()}`,
      title: 'Nova Coluna',
      items: [],
      color: '#6645EB'
    };
    onUpdateColumns([...columns, newColumn]);
  };

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {columns.map((column) => (
              <div key={column.id} className="flex-shrink-0">
                <SortableContext
                  items={column.items.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <KanbanColumn
                    column={column}
                    onAddItem={onAddItem}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                    onCardClick={onCardClick}
                  />
                </SortableContext>
              </div>
            ))}
            
            <Card className="flex-shrink-0 w-64 p-4 border-dashed border-2 border-muted-foreground/30 hover:border-primary/50 transition-colors">
              <Button
                variant="ghost"
                onClick={handleAddColumn}
                className="w-full h-full min-h-[100px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Coluna
              </Button>
            </Card>
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

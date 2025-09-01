
import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnData, KanbanItem } from './KanbanBoard';
import { Plus, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KanbanColumnProps {
  column: KanbanColumnData;
  onAddItem?: (columnId: string, item: Omit<KanbanItem, 'id'>) => void;
  onEditItem?: (item: KanbanItem) => void;
  onDeleteItem?: (itemId: string) => void;
}

export function KanbanColumn({ 
  column, 
  onAddItem, 
  onEditItem, 
  onDeleteItem 
}: KanbanColumnProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);

  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const handleAddItem = () => {
    if (newItemTitle.trim() && onAddItem) {
      onAddItem(column.id, {
        title: newItemTitle.trim(),
        description: '',
      });
      setNewItemTitle('');
      setIsAddingItem(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    } else if (e.key === 'Escape') {
      setIsAddingItem(false);
      setNewItemTitle('');
    }
  };

  const isAtLimit = column.limit && column.items.length >= column.limit;

  return (
    <Card className="w-80 bg-muted/30 border-muted-foreground/20">
      <div className="p-4 border-b border-muted-foreground/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {isEditingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false);
                  if (e.key === 'Escape') {
                    setEditTitle(column.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="text-sm font-semibold border-none p-0 h-auto bg-transparent"
                autoFocus
              />
            ) : (
              <h3 
                className="text-sm font-semibold cursor-pointer hover:text-primary"
                onClick={() => setIsEditingTitle(true)}
              >
                {column.title}
              </h3>
            )}
            
            <Badge variant="secondary" className="text-xs">
              {column.items.length}
              {column.limit && `/${column.limit}`}
            </Badge>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                Editar título
              </DropdownMenuItem>
              <DropdownMenuItem>
                Definir limite
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div 
        ref={setNodeRef}
        className="p-4 space-y-3 min-h-[200px] max-h-[600px] overflow-y-auto"
      >
        {column.items.map((item) => (
          <KanbanCard
            key={item.id}
            item={item}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
          />
        ))}

        {isAddingItem ? (
          <Card className="p-3 border-dashed border-2 border-primary/50">
            <Input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Digite o título do item..."
              onKeyDown={handleKeyPress}
              className="border-none p-0 focus-visible:ring-0"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleAddItem}>
                Adicionar
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setIsAddingItem(false);
                  setNewItemTitle('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingItem(true)}
            disabled={isAtLimit}
            className="w-full justify-start text-muted-foreground hover:text-foreground border-dashed border-2 border-transparent hover:border-muted-foreground/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isAtLimit ? 'Limite atingido' : 'Adicionar item'}
          </Button>
        )}
      </div>
    </Card>
  );
}

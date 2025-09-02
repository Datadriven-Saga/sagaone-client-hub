
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanItem } from './KanbanBoard';
import { 
  Calendar, 
  MessageSquare, 
  Paperclip, 
  MoreHorizontal,
  Edit,
  Trash2,
  User
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KanbanCardProps {
  item: KanbanItem;
  isDragging?: boolean;
  onEdit?: (item: KanbanItem) => void;
  onDelete?: (itemId: string) => void;
  onCardClick?: (item: KanbanItem) => void;
}

export function KanbanCard({ item, isDragging, onEdit, onDelete, onCardClick }: KanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${
        isDragging ? 'rotate-3 shadow-lg' : ''
      } ${
        item.prospeccaoCanal === 'Whatsapp' 
          ? 'border-t-4 border-t-green-500' 
          : item.prospeccaoCanal === 'Ligação' 
          ? 'border-t-4 border-t-blue-500' 
          : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onCardClick?.(item)}
    >
      <div className="space-y-2 w-full overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground leading-tight break-words">
              {item.title}
            </h4>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                {item.description}
              </p>
            )}
          </div>
          
          {(isHovered || isDragging) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(item)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(item.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 w-full">
            {item.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs break-words max-w-full">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Prospecção info */}
        {item.prospeccaoNome && (
          <div className="flex items-center gap-1 w-full">
            <Badge variant="outline" className="text-xs break-words max-w-full">
              {item.prospeccaoNome}
            </Badge>
          </div>
        )}

        {/* Channel indicator */}
        {item.channel && (
          <div className="flex items-center gap-1 w-full min-w-0">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground break-words">{item.channel}</span>
          </div>
        )}

        {/* Priority indicator */}
        {item.priority && (
          <div className="flex items-center gap-1 w-full min-w-0">
            <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)} flex-shrink-0`} />
            <span className="text-xs text-muted-foreground capitalize break-words">{item.priority}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.dueDate && (
              <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs break-words">{item.dueDate}</span>
              </div>
            )}
          </div>

          {item.assignee && (
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src="" />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {getInitials(item.assignee)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}

import { useState } from "react";
import { Plus, UserPlus, CheckCircle, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onNovoLead: () => void;
  onNovoCheckin: () => void;
  onNovaVenda: () => void;
}

export const FloatingActionButton = ({
  onNovoLead,
  onNovoCheckin,
  onNovaVenda
}: FloatingActionButtonProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAction = (action: () => void) => {
    action();
    setIsExpanded(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Sub-buttons - aparecem quando expandido */}
      <div className={cn(
        "flex flex-col gap-2 transition-all duration-300",
        isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <Button
          onClick={() => handleAction(onNovaVenda)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-full px-4 h-10"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-medium">Nova Venda</span>
        </Button>
        
        <Button
          onClick={() => handleAction(onNovoCheckin)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-4 h-10"
        >
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Novo Check-in</span>
        </Button>
        
        <Button
          onClick={() => handleAction(onNovoLead)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-full px-4 h-10"
        >
          <UserPlus className="h-4 w-4" />
          <span className="text-sm font-medium">Novo Lead</span>
        </Button>
      </div>

      {/* Main FAB button */}
      <Button
        onClick={toggleExpanded}
        className={cn(
          "h-10 w-10 rounded-full shadow-xl transition-all duration-300",
          "bg-primary hover:bg-primary/90",
          isExpanded && "rotate-45"
        )}
      >
        {isExpanded ? (
          <X className="h-4 w-4 text-white" />
        ) : (
          <Plus className="h-4 w-4 text-white" />
        )}
      </Button>
    </div>
  );
};

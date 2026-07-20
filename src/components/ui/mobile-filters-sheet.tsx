import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileFiltersSheetProps {
  children: React.ReactNode;
  activeCount?: number;
  onClear?: () => void;
  desktopWrapperClassName?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}

/**
 * Em mobile: exibe apenas um botão "Filtros" (ícone) que abre um Sheet inferior
 * com todos os filtros. "Aplicar" fecha o sheet; os filtros já são aplicados
 * conforme o usuário interage (estado controlado pelos componentes filhos).
 * Em desktop: renderiza os filhos inline normalmente.
 */
export function MobileFiltersSheet({
  children,
  activeCount = 0,
  onClear,
  desktopWrapperClassName,
  triggerLabel = "Filtros",
  triggerClassName,
}: MobileFiltersSheetProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return <div className={desktopWrapperClassName}>{children}</div>;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-2", triggerClassName)}
        >
          <Filter className="h-4 w-4" />
          {triggerLabel}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5 leading-none">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col p-4 gap-0">
        <SheetHeader className="text-left">
          <SheetTitle>{triggerLabel}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-3">{children}</div>
        <SheetFooter className="flex-row gap-2 sm:flex-row">
          {onClear && (
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
              }}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
          <Button onClick={() => setOpen(false)} className="flex-1">
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
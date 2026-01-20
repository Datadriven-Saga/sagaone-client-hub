import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  variant?: "overlay" | "inline" | "banner";
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = "Carregando dados, aguarde...",
  variant = "banner",
  className
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  if (variant === "overlay") {
    return (
      <div className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}>
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 py-8",
        className
      )}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  // Default: banner
  return (
    <div className={cn(
      "flex items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300",
      className
    )}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <p className="text-sm font-medium text-primary">{message}</p>
    </div>
  );
}

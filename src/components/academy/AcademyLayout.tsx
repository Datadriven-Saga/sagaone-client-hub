import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AcademySidebar } from "./AcademySidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface AcademyLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  backPath?: string;
}

export function AcademyLayout({ 
  children, 
  title, 
  showBackButton = false,
  backPath = "/treinamentos"
}: AcademyLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      <AcademySidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        {(title || showBackButton) && (
          <header className="h-14 flex-shrink-0 border-b border-border bg-card flex items-center px-6 gap-4">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backPath)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            {title && (
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            )}
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { PanelLeft } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                <PanelLeft className="h-5 w-5" />
              </SidebarTrigger>
              
              {title && (
                <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              )}
            </div>
            
            <UserMenu />
          </header>

          {/* Main Content */}
          <main className="flex-1 px-6 pt-3 pb-6 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

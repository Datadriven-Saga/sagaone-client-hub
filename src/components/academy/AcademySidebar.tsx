import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Trophy,
  GraduationCap,
  Mic,
  MessageSquare,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/treinamentos" },
  { id: "ranking", label: "Ranking", icon: Trophy, path: "/treinamentos/ranking" },
  { id: "trilhas", label: "Simulações Práticas", icon: GraduationCap, path: "/treinamentos/trilhas" },
  { id: "voz", label: "Prática por Voz", icon: Mic, path: "/treinamentos/simulacoes-voz" },
  { id: "texto", label: "Prática por Texto", icon: MessageSquare, path: "/treinamentos/simulacoes-texto" },
  { id: "historico", label: "Histórico", icon: History, path: "/treinamentos/historico" },
  { id: "admin", label: "Painel Admin", icon: Settings, path: "/treinamentos/admin", adminOnly: true },
];

interface AcademySidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AcademySidebar({ collapsed = false, onToggle }: AcademySidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminOrTI, isGerente, isDiretor } = useUserAccessType();
  
  // Check if user has admin access to show admin panel
  const hasAdminAccess = isAdminOrTI || isGerente || isDiretor;
  
  // Filter nav items based on permissions
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return hasAdminAccess;
    }
    return true;
  });

  const isActive = (path: string) => {
    if (path === "/treinamentos") {
      return location.pathname === "/treinamentos";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className={cn(
        "h-full bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Saga Academy</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Back to Main Menu */}
      <div className="p-2 border-b border-border">
        <button
          onClick={() => navigate("/")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ChevronLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Voltar ao Menu</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-primary/10 text-primary border-l-4 border-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive(item.path) && "text-primary")} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.email?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email?.split("@")[0] || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

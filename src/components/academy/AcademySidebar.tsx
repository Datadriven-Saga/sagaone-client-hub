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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        "h-full flex flex-col transition-all duration-300",
        "bg-sagaone-primary text-primary-foreground",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sagaone-login-card flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-primary-foreground">Saga Academy</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-lg bg-sagaone-login-card flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Back to Main Menu */}
      <div className="p-2 border-b border-primary-foreground/10">
        <button
          onClick={() => navigate("/")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          )}
        >
          <ChevronLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Voltar ao Menu</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-sidebar">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-sagaone-login-card text-white"
                : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="p-2 border-t border-primary-foreground/10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="w-full h-10 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* User Profile */}
      <div className="p-4 border-t border-primary-foreground/10">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-sagaone-login-card text-white">
              {user?.email?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-foreground truncate">
                {user?.email?.split("@")[0] || "Usuário"}
              </p>
              <p className="text-xs text-primary-foreground/60 truncate">
                {user?.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

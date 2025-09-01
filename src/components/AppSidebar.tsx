import { 
  Home, 
  Users, 
  Bell, 
  Target, 
  Headphones, 
  Store, 
  Search, 
  TrendingUp, 
  FileText, 
  BookOpen, 
  Settings, 
  Shield 
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import tavatLogo from "@/assets/tavat-logo.png";

const menuItems = [
  { title: "Página Inicial", url: "/", icon: Home },
  { title: "Carteira de Clientes", url: "/clientes", icon: Users },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
  { title: "Prospecção", url: "/prospeccao", icon: Target },
  { title: "Central de Atendimento", url: "/atendimento", icon: Headphones },
  { title: "Loja", url: "/loja", icon: Store },
  { title: "Busca & Resgate", url: "/busca-resgate", icon: Search },
  { title: "Metas e OKR", url: "/metas", icon: TrendingUp },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Treinamentos", url: "/treinamentos", icon: BookOpen },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Administração", url: "/administracao", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      className="transition-all duration-300"
      collapsible="icon"
    >
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={tavatLogo} 
            alt="TAVAT" 
            className="h-8 w-8 flex-shrink-0"
          />
          {!isCollapsed && (
            <span className="text-sidebar-foreground font-bold text-lg">
              TAVAT
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
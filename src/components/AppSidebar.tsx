import { 
  Home, 
  Users, 
  Bell, 
  Target, 
  FileText, 
  BookOpen, 
  Settings, 
  Shield,
  Bot,
  UserX
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
import sagaOneLogo from "@/assets/saga-one-menu-logo.png";

const menuItems = [
  { title: "Página Inicial", url: "/", icon: Home },
  { title: "Agentes de IA", url: "/agentes-ia", icon: Bot },
  { title: "Prospecção", url: "/prospeccao", icon: Target },
  { title: "Carteira de Clientes", url: "/clientes", icon: Users },
  { title: "Controle Opt Out", url: "/controle-opt-out", icon: UserX },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
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
            src={sagaOneLogo} 
            alt="Saga One Logo" 
            className="h-12 w-auto flex-shrink-0 object-contain rounded-lg"
          />
          {!isCollapsed && (
            <span className="text-sidebar-foreground font-bold text-lg">
              SAGA One
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "hover:bg-sidebar-accent/70 hover:scale-105 text-sidebar-foreground hover:text-sidebar-accent-foreground"
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
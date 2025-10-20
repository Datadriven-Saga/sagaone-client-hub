import { 
  Home, 
  Users, 
  Bell, 
  Target, 
  FileText, 
  BookOpen, 
  Settings, 
  Shield,
  Bot
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import sagaOneLogo from "@/assets/saga-one-menu-logo.png";

const menuItems = [
  { title: "Página Inicial", url: "/", icon: Home },
  { title: "Agentes de IA", url: "/agentes-ia", icon: Bot },
  { title: "Prospecção", url: "/prospeccao", icon: Target },
  { title: "Carteira de Clientes", url: "/clientes", icon: Users },
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 group relative">
            <div className={`relative flex items-center justify-center ${isCollapsed ? 'w-5 h-5' : 'w-12 h-12'}`}>
              <img 
                src={sagaOneLogo} 
                alt="Saga One Logo" 
                className={`object-contain rounded-lg transition-all ${
                  isCollapsed 
                    ? 'w-5 h-5 group-hover:opacity-0' 
                    : 'w-auto h-12'
                }`}
              />
              {isCollapsed && (
                <SidebarTrigger className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
              )}
            </div>
            {!isCollapsed && (
              <span className="text-sidebar-foreground font-bold text-lg">
                SAGA One
              </span>
            )}
          </div>
          {!isCollapsed && <SidebarTrigger className="h-8 w-8" />}
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
                            : "hover:bg-[#ffffff] hover:scale-105 text-sidebar-foreground hover:text-white"
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
import { useState } from "react";
import { 
  Home, 
  Users, 
  Target, 
  FileText, 
  BookOpen, 
  Settings, 
  Shield,
  Bot,
  ChevronDown,
  ChevronRight,
  Calendar,
  Headphones,
  BarChart3,
  MessageSquareText,
  UserCheck,
  ShoppingCart,
  LayoutDashboard,
  GraduationCap,
  History
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import sagaOneLogo from "@/assets/saga-one-menu-logo.png";

const topMenuItems = [
  { title: "Página Inicial", url: "/", icon: Home },
];

const prospeccaoSubItems = [
  { title: "Eventos", url: "/prospeccao/eventos", icon: Calendar },
  { title: "Atendimentos", url: "/prospeccao/atendimento", icon: Headphones },
  { title: "Recepção", url: "/prospeccao/recepcao", icon: UserCheck },
  { title: "Vendas", url: "/prospeccao/vendas", icon: ShoppingCart },
  { title: "Templates", url: "/prospeccao/templates", icon: MessageSquareText },
  { title: "Performance", url: "/prospeccao/performance", icon: BarChart3 },
];

const treinamentosSubItems = [
  { title: "Dashboard", url: "/treinamentos", icon: LayoutDashboard, exact: true },
  { title: "Simulações", url: "/treinamentos/simulacoes", icon: GraduationCap },
  { title: "Histórico", url: "/treinamentos/historico", icon: History },
];

const agentesIASubItems = [
  { title: "Agentes", url: "/agentes-ia", icon: Bot },
];

// Items apenas para Administrador
const afterProspeccaoItemsAdmin = [
  { title: "Carteira de Clientes", url: "/clientes", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
];

const bottomMenuItemsPublic = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const bottomMenuItemsAdmin = [
  { title: "Administração", url: "/administracao", icon: Shield },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { isAdmin, isAdminOrTI, isGerente, isDiretor } = useUserAccessType();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };
  
  // Submenus recolhidos por padrão, abrem apenas se a rota atual está dentro
  const [isProspeccaoOpen, setIsProspeccaoOpen] = useState(currentPath.startsWith('/prospeccao'));
  const [isTreinamentosOpen, setIsTreinamentosOpen] = useState(currentPath.startsWith('/treinamentos'));
  const [isAgentesIAOpen, setIsAgentesIAOpen] = useState(currentPath.startsWith('/agentes-ia'));

  // Check if user has admin access to show admin panel
  const hasAdminAccess = isAdminOrTI || isGerente || isDiretor;

  // Gestores e admins podem ver o item Administração
  const canSeeAdministracao = isAdmin || isGerente;
  
  const bottomMenuItems = canSeeAdministracao
    ? [...bottomMenuItemsPublic, ...bottomMenuItemsAdmin]
    : bottomMenuItemsPublic;

  // Use treinamentos items directly (no admin filtering needed now)
  const filteredTreinamentosItems = treinamentosSubItems;

  return (
    <Sidebar
      className="transition-all duration-300"
      collapsible="icon"
    >
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center justify-center ${isCollapsed ? 'w-5 h-5' : 'w-[2.7rem] h-[2.7rem]'}`}>
            <img 
              src={sagaOneLogo} 
              alt="Saga One Logo" 
              className={`object-contain rounded-lg transition-all ${
                isCollapsed 
                  ? 'w-5 h-5' 
                  : 'w-auto h-[2.7rem]'
              }`}
            />
          </div>
          {!isCollapsed && (
            <span className="text-sidebar-foreground font-bold text-lg">
              SAGA One
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col h-full scrollbar-sidebar">
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {topMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      onClick={closeMobileSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "hover:scale-105 hover:opacity-80 text-sidebar-foreground"
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

              {/* Prospecção com submenu */}
              <SidebarMenuItem>
                <Collapsible open={isProspeccaoOpen} onOpenChange={setIsProspeccaoOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between hover:scale-105 hover:opacity-80 text-sidebar-foreground"
                    >
                      <div className="flex items-center gap-3">
                        <Target className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium">Prospecção</span>}
                      </div>
                      {!isCollapsed && (
                        isProspeccaoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!isCollapsed && (
                    <CollapsibleContent className="pl-4 mt-1 space-y-1">
                      {prospeccaoSubItems.map((subItem) => (
                        <SidebarMenuButton key={subItem.title} asChild>
                          <NavLink 
                            to={subItem.url}
                            onClick={closeMobileSidebar}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                              currentPath.startsWith(subItem.url)
                                ? "font-bold border-b-2 border-primary"
                                : "hover:scale-105 hover:opacity-80"
                            }`}
                          >
                            <subItem.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{subItem.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      ))}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </SidebarMenuItem>

              {/* Treinamentos com submenu */}
              <SidebarMenuItem>
                <Collapsible open={isTreinamentosOpen} onOpenChange={setIsTreinamentosOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between hover:scale-105 hover:opacity-80 text-sidebar-foreground"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium">Treinamentos</span>}
                      </div>
                      {!isCollapsed && (
                        isTreinamentosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!isCollapsed && (
                    <CollapsibleContent className="pl-4 mt-1 space-y-1">
                      {filteredTreinamentosItems.map((subItem) => (
                        <SidebarMenuButton key={subItem.title} asChild>
                          <NavLink 
                            to={subItem.url}
                            end={subItem.exact}
                            onClick={closeMobileSidebar}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                              (subItem.exact && currentPath === subItem.url) || 
                              (!subItem.exact && currentPath.startsWith(subItem.url) && currentPath !== '/treinamentos')
                                ? "font-bold border-b-2 border-primary"
                                : "hover:scale-105 hover:opacity-80"
                            }`}
                          >
                            <subItem.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{subItem.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      ))}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </SidebarMenuItem>

              {/* Agentes de IA com submenu - apenas para TI e Admin */}
              {isAdminOrTI && (
                <SidebarMenuItem>
                  <Collapsible open={isAgentesIAOpen} onOpenChange={setIsAgentesIAOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between hover:scale-105 hover:opacity-80 text-sidebar-foreground"
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span className="font-medium">Agentes de IA</span>}
                        </div>
                        {!isCollapsed && (
                          isAgentesIAOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <CollapsibleContent className="pl-4 mt-1 space-y-1">
                        {agentesIASubItems.map((subItem) => (
                          <SidebarMenuButton key={subItem.title} asChild>
                            <NavLink 
                              to={subItem.url}
                              end={subItem.url === '/agentes-ia'}
                              onClick={closeMobileSidebar}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                                (subItem.url === '/agentes-ia' && currentPath === '/agentes-ia') ||
                                (subItem.url !== '/agentes-ia' && currentPath.startsWith(subItem.url))
                                  ? "font-bold border-b-2 border-primary"
                                  : "hover:scale-105 hover:opacity-80"
                              }`}
                            >
                              <subItem.icon className="h-4 w-4 flex-shrink-0" />
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        ))}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* Items apenas para Admin */}
              {isAdmin && afterProspeccaoItemsAdmin.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      onClick={closeMobileSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "hover:scale-105 hover:opacity-80 text-sidebar-foreground"
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

        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      onClick={closeMobileSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "hover:scale-105 hover:opacity-80 text-sidebar-foreground"
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

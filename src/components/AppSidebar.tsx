import { useState } from "react";
import { 
  Home, 
  Users, 
  Target, 
  FileText, 
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
  Phone,
  MessageSquare,
  Medal,
  User,
  TrendingUp,
  PackageCheck,
  GitMerge,
  Tag,
  PackageOpen
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
];

const performanceSubItems = [
  { title: "Resumo", url: "/resultados", icon: LayoutDashboard, exact: true },
  { title: "WhatsApp", url: "/resultados/whatsapp", icon: MessageSquare },
  { title: "Ligação", url: "/resultados/ligacao", icon: Phone },
  { title: "Ranking", url: "/resultados/ranking", icon: Medal },
  { title: "Desempenho", url: "/resultados/desempenho", icon: BarChart3 },
  { title: "Individual", url: "/resultados/individual", icon: User },
  { title: "Relatórios", url: "/resultados/relatorios", icon: FileText },
];

const agentesIASubItems = [
  { title: "Agentes", url: "/agentes-ia", icon: Bot },
];

const algoritmosCompraItems = [
  { title: "Avaliação de Compra", url: "/algoritmos/compra/avaliacao", icon: ShoppingCart },
  { title: "Políticas de Compra", url: "/algoritmos/compra/politicas", icon: ShoppingCart },
  { title: "Simulação de Compra", url: "/algoritmos/compra/simulacao", icon: ShoppingCart },
];

const algoritmosVendaItems = [
  { title: "Atualizar Price", url: "/algoritmos/venda/atualizar-price", icon: Tag },
  { title: "Histórico de Precificação", url: "/algoritmos/venda/historico-precificacao", icon: Tag },
];

const algoritmosPosVendasItems = [
  { title: "Políticas Pós-Vendas", url: "/algoritmos/pos-vendas/politicas", icon: PackageOpen },
  { title: "Eventos Pós-Vendas", url: "/algoritmos/pos-vendas/eventos", icon: PackageOpen },
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
  const { permissions } = useUserAccessType();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const p = (key: string): boolean => permissions[key] ?? false;

  // Submenus recolhidos por padrão, abrem apenas se a rota atual está dentro
  const [isProspeccaoOpen, setIsProspeccaoOpen] = useState(currentPath.startsWith('/prospeccao'));
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(currentPath.startsWith('/resultados'));
  const [isAgentesIAOpen, setIsAgentesIAOpen] = useState(currentPath.startsWith('/agentes-ia'));
  const [isAlgoritmosOpen, setIsAlgoritmosOpen] = useState(currentPath.startsWith('/algoritmos'));
  const [isAlgCompraOpen, setIsAlgCompraOpen] = useState(currentPath.startsWith('/algoritmos/compra'));
  const [isAlgVendaOpen, setIsAlgVendaOpen] = useState(currentPath.startsWith('/algoritmos/venda'));
  const [isAlgPosVendasOpen, setIsAlgPosVendasOpen] = useState(currentPath.startsWith('/algoritmos/pos-vendas'));

  // Sidebar visibility driven by permission flags
  const canSeeAdministracao = p("canAccessAdministracao") || p("canViewAuthenticator");
  const canSeeClientes = p("canViewClientes") && p("canAddClientes");
  const canSeeAgentesIA = p("canAccessAgentesIA");
  const canSeeConfiguracoes = p("canAccessConfiguracoes");
  const canSeeRelatorios = p("canAccessRelatorios");
  const canSeeResultados = p("canAccessResultados");
  const canSeePosVendas = p("canAccessPosVendas");
  const canSeeAlgCompra = p("canAccessAlgoritmosCompra");
  const canSeeAlgVenda = p("canAccessAlgoritmosVenda");
  const canSeeAlgPosVendas = p("canAccessAlgoritmosPosVendas");
  const canSeeAlgoritmos = canSeeAlgCompra || canSeeAlgVenda || canSeeAlgPosVendas;
  
  const bottomMenuItems = [
    ...(canSeeConfiguracoes ? bottomMenuItemsPublic : []),
    ...(canSeeAdministracao ? bottomMenuItemsAdmin : []),
  ];

  const renderCollapsibleMenu = (
    label: string,
    icon: React.ElementType,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    subItems: Array<{ title: string; url: string; icon: React.ElementType; exact?: boolean }>,
    pathPrefix: string
  ) => {
    const Icon = icon;
    return (
      <SidebarMenuItem>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between hover:scale-105 hover:opacity-80 text-sidebar-foreground"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">{label}</span>}
              </div>
              {!isCollapsed && (
                isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {!isCollapsed && (
            <CollapsibleContent className="pl-4 mt-1 space-y-1">
              {subItems.map((subItem) => (
                <SidebarMenuButton key={subItem.title} asChild>
                  <NavLink 
                    to={subItem.url}
                    end={subItem.exact}
                    onClick={closeMobileSidebar}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                      (subItem.exact && currentPath === subItem.url) || 
                      (!subItem.exact && currentPath.startsWith(subItem.url) && currentPath !== pathPrefix)
                        ? "font-bold border-b-2 border-primary"
                        : (subItem.exact && currentPath === subItem.url) 
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
    );
  };

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
              {p("canViewProspeccao") && renderCollapsibleMenu("Prospecção", Target, isProspeccaoOpen, setIsProspeccaoOpen, prospeccaoSubItems, '/prospeccao')}

              {/* Performance com submenu */}
              {canSeeResultados && renderCollapsibleMenu("Performance", TrendingUp, isPerformanceOpen, setIsPerformanceOpen, performanceSubItems, '/resultados')}

              {/* Agentes de IA com submenu */}
              {canSeeAgentesIA && renderCollapsibleMenu("Agentes de IA", Bot, isAgentesIAOpen, setIsAgentesIAOpen, agentesIASubItems, '/agentes-ia')}

              {/* Algoritmos com submenu aninhado */}
              {canSeeAlgoritmos && (
                <SidebarMenuItem>
                  <Collapsible open={isAlgoritmosOpen} onOpenChange={setIsAlgoritmosOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between hover:scale-105 hover:opacity-80 text-sidebar-foreground">
                        <div className="flex items-center gap-3">
                          <GitMerge className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span className="font-medium">Algoritmos</span>}
                        </div>
                        {!isCollapsed && (isAlgoritmosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <CollapsibleContent className="pl-3 mt-1 space-y-1">
                        {canSeeAlgCompra && (
                          <Collapsible open={isAlgCompraOpen} onOpenChange={setIsAlgCompraOpen}>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between text-sm text-sidebar-foreground hover:opacity-80">
                                <div className="flex items-center gap-2">
                                  <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                                  <span>Compra</span>
                                </div>
                                {isAlgCompraOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-5 mt-1 space-y-1">
                              {algoritmosCompraItems.map((s) => (
                                <SidebarMenuButton key={s.url} asChild>
                                  <NavLink
                                    to={s.url}
                                    onClick={closeMobileSidebar}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                                        isActive ? "font-bold border-b-2 border-primary" : "hover:opacity-80"
                                      }`
                                    }
                                  >
                                    <span>{s.title}</span>
                                  </NavLink>
                                </SidebarMenuButton>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        {canSeeAlgVenda && (
                          <Collapsible open={isAlgVendaOpen} onOpenChange={setIsAlgVendaOpen}>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between text-sm text-sidebar-foreground hover:opacity-80">
                                <div className="flex items-center gap-2">
                                  <Tag className="h-4 w-4 flex-shrink-0" />
                                  <span>Venda</span>
                                </div>
                                {isAlgVendaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-5 mt-1 space-y-1">
                              {algoritmosVendaItems.map((s) => (
                                <SidebarMenuButton key={s.url} asChild>
                                  <NavLink
                                    to={s.url}
                                    onClick={closeMobileSidebar}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                                        isActive ? "font-bold border-b-2 border-primary" : "hover:opacity-80"
                                      }`
                                    }
                                  >
                                    <span>{s.title}</span>
                                  </NavLink>
                                </SidebarMenuButton>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        {canSeeAlgPosVendas && (
                          <Collapsible open={isAlgPosVendasOpen} onOpenChange={setIsAlgPosVendasOpen}>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full justify-between text-sm text-sidebar-foreground hover:opacity-80">
                                <div className="flex items-center gap-2">
                                  <PackageOpen className="h-4 w-4 flex-shrink-0" />
                                  <span>Pós-Vendas</span>
                                </div>
                                {isAlgPosVendasOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-5 mt-1 space-y-1">
                              {algoritmosPosVendasItems.map((s) => (
                                <SidebarMenuButton key={s.url} asChild>
                                  <NavLink
                                    to={s.url}
                                    onClick={closeMobileSidebar}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-sidebar-foreground ${
                                        isActive ? "font-bold border-b-2 border-primary" : "hover:opacity-80"
                                      }`
                                    }
                                  >
                                    <span>{s.title}</span>
                                  </NavLink>
                                </SidebarMenuButton>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* Pós-Vendas */}
              {canSeePosVendas && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/pos-vendas"
                      onClick={closeMobileSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:scale-105 hover:opacity-80 text-sidebar-foreground"
                        }`
                      }
                    >
                      <PackageCheck className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">Pós-Vendas</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Carteira de Clientes e Relatórios */}
              {canSeeClientes && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/clientes" 
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
                      <Users className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">Carteira de Clientes</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {canSeeRelatorios && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/relatorios" 
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
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">Relatórios</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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

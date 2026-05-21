import { ReactNode, useState } from "react";
import ActiveCampaignJobIndicator from "./ActiveCampaignJobIndicator";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { FloatingActionButton } from "./FloatingActionButton";
import { ContatoModal } from "./ContatoModal";
import { CheckinConfirmModal } from "./CheckinConfirmModal";
import { RecepcaoModal } from "./RecepcaoModal";
import { PanelLeft, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contato } from "@/hooks/useContatoData";
import { useRecepcaoData, MultiCheckinData } from "@/hooks/useRecepcaoData";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function DashboardLayout({ children, title, showBackButton }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === "/" || location.pathname === "/dashboard";
  const shouldShowBack = showBackButton !== undefined ? showBackButton : !isHomePage;
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [pendingMultiCheckin, setPendingMultiCheckin] = useState<MultiCheckinData | null>(null);
  const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);
  const [contatoModalState, setContatoModalState] = useState<{
    isOpen: boolean;
    contato: Contato | null;
  }>({ isOpen: false, contato: null });

  const { buscarContatoMultiAtivo, registrarCheckinMulti } = useRecepcaoData();

  const handleNovoCheckin = () => {
    setIsRecepcaoModalOpen(true);
  };

  const handleOpenContatoFromFab = (contato: Contato) => {
    setContatoModalState({
      isOpen: true,
      contato: contato
    });
  };

  // Handle search from RecepcaoModal — agora multi-prospecção ativa
  const handleRecepcaoSearch = async (telefone: string): Promise<MultiCheckinData | null> => {
    const result = await buscarContatoMultiAtivo(telefone);
    if (result) setPendingMultiCheckin(result);
    return result;
  };

  const handleConfirmMultiCheckin = async (
    selectedIds: string[],
    nomeVisitanteNovo?: string
  ) => {
    if (!pendingMultiCheckin) return;
    setIsConfirmingCheckin(true);
    try {
      const res = await registrarCheckinMulti(pendingMultiCheckin, selectedIds, nomeVisitanteNovo);
      if (res.ok) window.dispatchEvent(new CustomEvent('lead-created'));
    } finally {
      setIsConfirmingCheckin(false);
      setPendingMultiCheckin(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header - Fixed */}
          <header className="h-14 md:h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 gap-2">
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-shrink">
              <SidebarTrigger className="h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors flex-shrink-0">
                <PanelLeft className="h-4 w-4 md:h-5 md:w-5" />
              </SidebarTrigger>
              
              {shouldShowBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              )}

              {title && (
                <h1 className="text-base md:text-xl font-semibold text-foreground truncate">{title}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <ActiveCampaignJobIndicator />
              <UserMenu />
            </div>
          </header>

          {/* Main Content - Scrollable area */}
          <main className="flex-1 p-3 md:p-6 min-h-0 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>

        {/* Global FAB — apenas Check-in (Novo Lead/Venda ficam no Kanban de Atendimento) */}
        <FloatingActionButton
          onNovoCheckin={handleNovoCheckin}
        />

        <RecepcaoModal
          isOpen={isRecepcaoModalOpen}
          onClose={() => setIsRecepcaoModalOpen(false)}
          onSearch={handleRecepcaoSearch}
        />

        <CheckinConfirmModal
          isOpen={!!pendingMultiCheckin}
          onClose={() => setPendingMultiCheckin(null)}
          data={null}
          multiData={pendingMultiCheckin}
          onConfirmMulti={handleConfirmMultiCheckin}
          loading={isConfirmingCheckin}
        />

        {contatoModalState.contato && (
          <ContatoModal
            isOpen={contatoModalState.isOpen}
            onClose={() => setContatoModalState({ isOpen: false, contato: null })}
            contato={contatoModalState.contato}
            onStatusChange={async () => {}}
            onDelete={async () => {}}
            onAssignResponsible={async () => {}}
          />
        )}
      </div>
    </SidebarProvider>
  );
}

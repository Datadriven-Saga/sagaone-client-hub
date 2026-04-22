import { ReactNode, useState, useEffect } from "react";
import ActiveCampaignJobIndicator from "./ActiveCampaignJobIndicator";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { FloatingActionButton } from "./FloatingActionButton";
import { NovoLeadModal } from "./NovoLeadModal";
import { ContatoModal } from "./ContatoModal";
import { CheckinConfirmModal } from "./CheckinConfirmModal";
import { RecepcaoModal } from "./RecepcaoModal";
import { PanelLeft, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
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
  const [isNovoLeadModalOpen, setIsNovoLeadModalOpen] = useState(false);
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [pendingMultiCheckin, setPendingMultiCheckin] = useState<MultiCheckinData | null>(null);
  const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);
  const [contatoModalState, setContatoModalState] = useState<{
    isOpen: boolean;
    contato: Contato | null;
  }>({ isOpen: false, contato: null });
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[]>([]);
  
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { buscarContatoMultiAtivo, registrarCheckinMulti } = useRecepcaoData();

  // Fetch profiles for NovoLeadModal
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!activeCompany?.id) return;
      
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('id, nome_completo, tipo_acesso, celular');
      
      if (error) {
        console.error('Error fetching profiles:', error);
        return;
      }
      
      if (profilesData) {
        const profilesWithEmail = profilesData.map(p => ({
          ...p,
          email: undefined as string | undefined
        }));
        
        try {
          const { data: usersData } = await supabase.functions.invoke('manage-users', {
            body: { action: 'list_users' }
          });
          
          if (usersData?.users) {
            usersData.users.forEach((user: any) => {
              const profileIndex = profilesWithEmail.findIndex(p => p.id === user.id);
              if (profileIndex !== -1) {
                profilesWithEmail[profileIndex].email = user.email;
              }
            });
          }
        } catch (e) {
          console.error('Error fetching users emails:', e);
        }
        
        setProfiles(profilesWithEmail);
      }
    };
    fetchProfiles();
  }, [activeCompany?.id]);

  const handleNovoLead = () => {
    setIsNovoLeadModalOpen(true);
  };

  const handleNovoCheckin = () => {
    setIsRecepcaoModalOpen(true);
  };

  const handleNovaVenda = () => {
    // Same flow as novo lead - user will complete sale in contact modal
    setIsNovoLeadModalOpen(true);
  };

  const handleOpenContatoFromFab = (contato: Contato) => {
    setContatoModalState({
      isOpen: true,
      contato: contato
    });
  };

  const handleLeadCreated = () => {
    // Trigger refetch if needed - pages can handle their own data refresh
    window.dispatchEvent(new CustomEvent('lead-created'));
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

        {/* Global FAB */}
        <FloatingActionButton
          onNovoLead={handleNovoLead}
          onNovoCheckin={handleNovoCheckin}
          onNovaVenda={handleNovaVenda}
        />

        {/* Global Modals */}
        <NovoLeadModal
          isOpen={isNovoLeadModalOpen}
          onClose={() => setIsNovoLeadModalOpen(false)}
          onLeadCreated={handleLeadCreated}
          onOpenContato={handleOpenContatoFromFab}
          profiles={profiles}
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

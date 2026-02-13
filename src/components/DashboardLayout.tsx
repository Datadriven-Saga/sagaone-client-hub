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
import { useRecepcaoData, CheckinData } from "@/hooks/useRecepcaoData";

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
  const [checkinConfirmData, setCheckinConfirmData] = useState<{
    nome: string;
    telefone: string;
    evento: string;
    isNewContact: boolean;
  } | null>(null);
  const [pendingCheckin, setPendingCheckin] = useState<CheckinData | null>(null);
  const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);
  const [contatoModalState, setContatoModalState] = useState<{
    isOpen: boolean;
    contato: Contato | null;
  }>({ isOpen: false, contato: null });
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[]>([]);
  
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { prospeccoes, buscarContatoPorTelefoneEvento, registrarCheckin } = useRecepcaoData();

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

  // Handle search from RecepcaoModal
  const handleRecepcaoSearch = async (telefone: string, eventoId: string): Promise<CheckinData | null> => {
    const contato = await buscarContatoPorTelefoneEvento(telefone, eventoId);
    const evento = prospeccoes.find(p => p.id === eventoId);
    
    const checkinData: CheckinData = {
      telefone,
      evento_id: eventoId,
      evento_nome: evento?.titulo || 'Evento',
      contato: contato,
      isNewContact: !contato
    };
    
    // Show confirmation modal
    setCheckinConfirmData({
      nome: contato?.nome || 'Novo Visitante',
      telefone,
      evento: evento?.titulo || 'Evento',
      isNewContact: !contato
    });
    setPendingCheckin(checkinData);
    
    return checkinData;
  };

  // Handle check-in confirmation
  const handleConfirmCheckin = async () => {
    if (!pendingCheckin) return;
    
    setIsConfirmingCheckin(true);
    try {
      const success = await registrarCheckin(pendingCheckin);
      if (success) {
        window.dispatchEvent(new CustomEvent('lead-created'));
      }
    } finally {
      setIsConfirmingCheckin(false);
      setCheckinConfirmData(null);
      setPendingCheckin(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header - Fixed */}
          <header className="h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                <PanelLeft className="h-5 w-5" />
              </SidebarTrigger>
              
              {shouldShowBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-9 w-9 flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}

              {title && (
                <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <ActiveCampaignJobIndicator />
              <UserMenu />
            </div>
          </header>

          {/* Main Content - Scrollable area */}
          <main className="flex-1 p-6 min-h-0 overflow-y-auto overflow-x-hidden">
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
          prospeccoes={prospeccoes}
        />

        <CheckinConfirmModal
          isOpen={!!checkinConfirmData}
          onClose={() => {
            setCheckinConfirmData(null);
            setPendingCheckin(null);
          }}
          onConfirm={handleConfirmCheckin}
          data={checkinConfirmData}
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

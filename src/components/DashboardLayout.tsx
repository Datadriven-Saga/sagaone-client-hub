import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { FloatingActionButton } from "./FloatingActionButton";
import { NovoLeadModal } from "./NovoLeadModal";
import { ContatoModal } from "./ContatoModal";
import { RecepcaoModal } from "./RecepcaoModal";
import { PanelLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Contato } from "@/hooks/useContatoData";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [isNovoLeadModalOpen, setIsNovoLeadModalOpen] = useState(false);
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [contatoModalState, setContatoModalState] = useState<{
    isOpen: boolean;
    contato: Contato | null;
  }>({ isOpen: false, contato: null });
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[]>([]);
  
  const { activeCompany } = useCompany();
  const { user } = useAuth();

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

  const handleRecepcaoSave = async (data: { nome_cliente: string; telefone_cliente: string; nome_campanha: string; id_maia?: string }) => {
    if (!activeCompany?.id) return;
    
    try {
      await supabase.from('recepcao_visitas').insert({
        ...data,
        empresa_id: activeCompany.id
      });
      
      // Also check for existing contact and update status to Check-in
      const normalizedPhone = data.telefone_cliente.replace(/\D/g, '');
      const { data: existingContatos } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', activeCompany.id);
      
      const existingContato = existingContatos?.find(c => {
        const contatoPhone = (c.telefone || '').replace(/\D/g, '');
        return contatoPhone === normalizedPhone || 
               contatoPhone.endsWith(normalizedPhone) || 
               normalizedPhone.endsWith(contatoPhone);
      });

      if (existingContato) {
        await supabase
          .from('contatos')
          .update({ status: 'Check-in' })
          .eq('id', existingContato.id);
      } else {
        await supabase.from('contatos').insert({
          nome: data.nome_cliente,
          telefone: data.telefone_cliente,
          origem: 'Outros',
          status: 'Check-in',
          empresa_id: activeCompany.id,
          responsavel_email: user?.id,
          observacoes: 'Check-in registrado via Recepção'
        });
      }

      window.dispatchEvent(new CustomEvent('lead-created'));
    } catch (error) {
      console.error('Error saving recepcao:', error);
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header - Fixed */}
          <header className="h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                <PanelLeft className="h-5 w-5" />
              </SidebarTrigger>
              
              {title && (
                <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              )}
            </div>
            
            <UserMenu />
          </header>

          {/* Main Content - Container for scrollable content */}
          <main className="flex-1 p-6 min-h-0 flex flex-col overflow-hidden">
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
          onSave={handleRecepcaoSave}
          initialData={null}
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

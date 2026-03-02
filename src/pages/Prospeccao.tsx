import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Target, CheckCircle, Edit, MoreVertical, UserCheck, Plus, Users, ArrowLeft, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, ScanLine, Send, Loader2, Eye, Phone, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProspeccaoGlobalFilter, ProspeccaoGlobalFilters } from "@/components/ProspeccaoGlobalFilter";
import { UploadPlanilha } from "@/components/UploadPlanilha";
import { BaseExistente } from "@/components/BaseExistente";
import { CriarProspeccaoModal } from "@/components/CriarProspeccaoModal";
import { ContatoModal } from "@/components/ContatoModal";
import { RecepcaoModal } from "@/components/RecepcaoModal";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { CheckinConfirmModal } from "@/components/CheckinConfirmModal";
import { RecepcaoTable } from "@/components/RecepcaoTable";
import { ProspeccaoVisaoGeral } from "@/components/ProspeccaoVisaoGeral";
import { HistoricoImportacaoModal } from "@/components/HistoricoImportacaoModal";
import { ClientesPorUsuarioModal } from "@/components/ClientesPorUsuarioModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { NovoLeadModal } from "@/components/NovoLeadModal";
import { DescarteLeadModal } from "@/components/DescarteLeadModal";
import { ClientesImportadosList } from "@/components/ClientesImportadosList";
import { VendasProspeccaoTab } from "@/components/VendasProspeccaoTab";
import { EventoBaseModal } from "@/components/EventoBaseModal";
import DispararCustoModal from "@/components/DispararCustoModal";
import { useVendasProspeccao } from "@/hooks/useVendasProspeccao";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useCompany } from "@/contexts/CompanyContext";
import { useProspeccaoLogs } from "@/hooks/useProspeccaoLogs";
import { useContatoData, kanbanStatusMap, Contato } from "@/hooks/useContatoData";
import { useAutoAtribuirLeads } from "@/hooks/useAutoAtribuirLeads";
import { useRecepcaoData } from "@/hooks/useRecepcaoData";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMetricasLigacao, MetricasLigacaoExternas } from "@/hooks/useMetricasLigacao";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
  base_id?: string;
}

interface ProspeccaoProps {
  defaultTab?: 'eventos' | 'atendimento' | 'recepcao' | 'vendas';
}

const Prospeccao = ({ defaultTab }: ProspeccaoProps) => {
  console.log('🚀 Prospeccao component initiated');
  
  // ✅ TODOS OS HOOKS DEVEM VIR PRIMEIRO - ANTES DE QUALQUER LÓGICA
  const navigate = useNavigate();
  
  // === useState hooks ===
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProspeccao, setEditingProspeccao] = useState<any>(null);
  const [modalContato, setModalContato] = useState<{ 
    isOpen: boolean; 
    contato: Contato | null; 
    columnId?: string;
    requireProdutoVendido?: boolean;
    pendingVendaStatus?: { fromStatus: string; toStatus: string };
  }>({
    isOpen: false,
    contato: null,
    columnId: undefined,
    requireProdutoVendido: false,
    pendingVendaStatus: undefined
  });
  const [activeTab, setActiveTab] = useState(() => {
    // Se defaultTab for passado, usar a aba correspondente
    if (defaultTab === 'eventos') return 'eventos';
    if (defaultTab === 'atendimento') return 'kanban';
    if (defaultTab === 'recepcao') return 'recepcao';
    if (defaultTab === 'vendas') return 'vendas';
    const savedTab = sessionStorage.getItem('prospeccao_active_tab');
    return savedTab || 'eventos';
  });
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [listaSortColumn, setListaSortColumn] = useState<string>('updated_at');
  const [listaSortDirection, setListaSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAdicionarClientes, setShowAdicionarClientes] = useState(false);
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [recepcaoInitialData, setRecepcaoInitialData] = useState<any>(null);
  const [isQRCodeScannerOpen, setIsQRCodeScannerOpen] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [isClientesPorUsuarioModalOpen, setIsClientesPorUsuarioModalOpen] = useState(false);
  const [isNovoLeadModalOpen, setIsNovoLeadModalOpen] = useState(false);
  const [descarteModal, setDescarteModal] = useState<{
    isOpen: boolean;
    contatoId: string;
    contatoNome: string;
    fromStatus: string;
  }>({
    isOpen: false,
    contatoId: '',
    contatoNome: '',
    fromStatus: ''
  });
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string; departamento?: string | null }[]>([]);
  const [eventosLigacaoValidos, setEventosLigacaoValidos] = useState<Set<string>>(new Set());
  const [loadingEventosLigacao, setLoadingEventosLigacao] = useState(false);
  const [eventosLigacaoVerificados, setEventosLigacaoVerificados] = useState(false);
  const [globalFilters, setGlobalFilters] = useState<ProspeccaoGlobalFilters>({
    prospeccaoId: "todos",
    dataInicio: "",
    dataFim: "",
    responsavelId: "todos",
    status: "todos",
    dadosLead: "",
showAllEvents: true
  });
  const [disparandoIA, setDisparandoIA] = useState<string | null>(null);
  const [contagemPendentes, setContagemPendentes] = useState<Record<string, { total: number; pendentes: number; disparados: number }>>({});
  const [eventoBaseModal, setEventoBaseModal] = useState<{
    isOpen: boolean;
    prospeccao: any | null;
  }>({
    isOpen: false,
    prospeccao: null
  });
  const [deleteEventoModal, setDeleteEventoModal] = useState<{
    isOpen: boolean;
    prospeccao: any | null;
  }>({
    isOpen: false,
    prospeccao: null
  });
  const [deletingEvento, setDeletingEvento] = useState(false);
  const [custoModal, setCustoModal] = useState<{
    isOpen: boolean;
    prospeccaoId: string;
    eventoNome: string;
    canal: string;
    totalContatos: number;
  }>({
    isOpen: false,
    prospeccaoId: '',
    eventoNome: '',
    canal: '',
    totalContatos: 0,
  });
  
  // === Custom Hooks e Context Hooks ===
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany, loading: companyLoading, switchCompany } = useCompany();
  const { canAddClientes, isAdminOrTI, canUploadBase, canCreateEventos, canManageEventos, isVendedor, isSDR } = useUserAccessType();
  const { registrarMovimentacao } = useProspeccaoLogs();
  const { 
    contatos, 
    prospeccoes,
    contatosProspeccoes,
    loading, 
    loadingContatos,
    adicionarContatos,
    atualizarContato,
    atualizarStatusContato,
    excluirContato,
    excluirContatosEmMassa,
    excluirTodosContatosDaEmpresa,
    atribuirResponsavel,
    getMetricas, 
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    toggleEventoLigacaoAtivo,
    reenviarGatilhos,
    dispararParaIA,
    contarContatosPendentesDisparo,
    fetchProspeccoes,
    loadContatos,
    contatosLoaded,
    refetch
  } = useContatoData();
  const { vendas, criarVenda, refetch: refetchVendas } = useVendasProspeccao();
  const { 
    visitas, 
    totalVisitas,
    prospeccoes: recepcaoProspeccoes,
    loading: loadingVisitas,
    adicionarVisita, 
    excluirVisita,
    buscarContatoPorTelefoneEvento,
    registrarCheckin,
    validarEvento,
    recepcaoEventoFilter,
    setRecepcaoEventoFilter,
    recepcaoStatusFilter,
    setRecepcaoStatusFilter,
    recepcaoPage,
    setRecepcaoPage,
    PAGE_SIZE: recepcaoPageSize,
  } = useRecepcaoData();
  const { fetchMetricasLigacao } = useMetricasLigacao();
  
  // Hook para atribuição automática de leads (vendedores)
  const { 
    isLimitedUser, 
    atribuirLeadsAutomaticamente, 
    verificarEAtribuirSeNecessario,
    loading: atribuindoLeads 
  } = useAutoAtribuirLeads();
  
  // State para métricas externas de IA Ligação
  const [metricasLigacaoExternas, setMetricasLigacaoExternas] = useState<Record<string, MetricasLigacaoExternas>>({});

  // State for check-in confirmation modal
  const [checkinConfirmData, setCheckinConfirmData] = useState<{
    nome: string;
    telefone: string;
    evento: string;
    isNewContact: boolean;
  } | null>(null);
  const [pendingCheckin, setPendingCheckin] = useState<any>(null);
  const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);

  // Handle search from RecepcaoModal
  const handleRecepcaoSearch = async (telefone: string, eventoId: string) => {
    const contato = await buscarContatoPorTelefoneEvento(telefone, eventoId);
    const evento = recepcaoProspeccoes.find(p => p.id === eventoId);
    
    const checkinData = {
      telefone,
      evento_id: eventoId,
      evento_nome: evento?.titulo || 'Evento',
      contato: contato,
      isNewContact: !contato
    };
    
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
      await registrarCheckin(pendingCheckin);
      refetch();
    } finally {
      setIsConfirmingCheckin(false);
      setCheckinConfirmData(null);
      setPendingCheckin(null);
    }
  };

  // Handle QR scan complete
  const handleQRScanComplete = (data: any) => {
    setCheckinConfirmData({
      nome: data.contato?.nome || 'Novo Visitante',
      telefone: data.telefone,
      evento: data.evento_nome || 'Evento',
      isNewContact: data.isNewContact
    });
    setPendingCheckin(data);
  };

  // === useEffect hooks ===
  // Atualizar activeTab quando defaultTab mudar (navegação entre sub-módulos)
  useEffect(() => {
    if (defaultTab === 'eventos') {
      setActiveTab('eventos');
      setShowAdicionarClientes(false);
    } else if (defaultTab === 'atendimento') {
      setActiveTab('kanban');
    } else if (defaultTab === 'recepcao') {
      setActiveTab('recepcao');
    } else if (defaultTab === 'vendas') {
      setActiveTab('vendas');
    }
  }, [defaultTab]);
  
  console.log('🔑 User from auth:', user);
  console.log('📊 Data from hooks - contatos:', contatos?.length, 'prospeccoes:', prospeccoes?.length, 'loading:', loading);

  // Buscar profiles de vendedores vinculados à empresa ativa
  // Filtro: apenas usuários com vínculo em user_empresas E tipo_acesso vendedor/similar
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!activeCompany?.id) return;
      
      try {
        // 1. Buscar IDs de usuários vinculados à empresa ativa
        const { data: userEmpresasData, error: ueError } = await supabase
          .from('user_empresas')
          .select('user_id')
          .eq('empresa_id', activeCompany.id);
        
        if (ueError) {
          console.error('Error fetching user_empresas:', ueError);
          return;
        }

        const userIds = (userEmpresasData || []).map(ue => ue.user_id).filter(Boolean);
        
        if (userIds.length === 0) {
          setProfiles([]);
          return;
        }

        // 2. Buscar profiles desses usuários, priorizando vendedores
        const { data: profilesData, error } = await supabase
          .from('profiles')
          .select('id, nome_completo, tipo_acesso, celular, departamento')
          .in('id', userIds)
          .in('tipo_acesso', ['Vendedor', 'CRM', 'Gerente de Loja', 'Gerente de Leads', 'Administrador', 'TI', 'Diretor', 'Recepcionista']);
        
        if (error) {
          console.error('Error fetching profiles:', error);
          return;
        }
        
        if (profilesData && profilesData.length > 0) {
          // 3. Buscar emails dos usuários via função segura
          const { data: emailsData } = await supabase
            .rpc('get_users_emails', { user_ids: profilesData.map(p => p.id) });
          
          const emailMap = new Map<string, string>();
          if (emailsData) {
            emailsData.forEach((e: { user_id: string; email: string }) => {
              emailMap.set(e.user_id, e.email);
            });
          }
          
          setProfiles(profilesData.map(p => ({
            ...p,
            email: emailMap.get(p.id) || undefined
          })));
        }
      } catch (error) {
        console.error('Error in fetchProfiles:', error);
      }
    };
    
    fetchProfiles();
  }, [activeCompany?.id]);

  // Recarregar eventos quando o filtro "mostrar todos" mudar
  useEffect(() => {
    if (activeCompany?.id) {
      fetchProspeccoes(globalFilters.showAllEvents);
    }
  }, [globalFilters.showAllEvents, activeCompany?.id, fetchProspeccoes]);

  // Sincronizar eventos de Ligação com o webhook externo
  const [sincronizandoLigacao, setSincronizandoLigacao] = useState(false);
  
  const sincronizarEventosLigacao = async (showToast = false) => {
    if (!activeCompany?.id) return;
    
    setSincronizandoLigacao(true);
    setLoadingEventosLigacao(true);
    
    try {
      // Buscar agente Pri(Ligação) vinculado à empresa para pegar o telefone
      const { data: agentesVinculados } = await supabase
        .from('agente_empresas')
        .select(`
          agente_id,
          agentes_ia (
            id,
            nome,
            telefone,
            ativo
          )
        `)
        .eq('empresa_id', activeCompany.id);
      
      const agentes = (agentesVinculados || [])
        .map((ae: any) => ae.agentes_ia)
        .filter((a: any) => a && a.ativo);
      
      // Buscar agente Pri(Ligação)
      const agenteSearchPatterns = ['ligação', 'ligacao', 'ligaçao'];
      const agenteLigacao = agentes.find((a: any) => {
        const nome = String(a?.nome || '').toLowerCase();
        const temPri = nome.includes('pri');
        const temLigacao = agenteSearchPatterns.some(pattern => nome.includes(pattern));
        return temPri && temLigacao && a?.telefone;
      });
      
      if (!agenteLigacao?.telefone) {
        console.log('⚠️ Agente Pri(Ligação) não encontrado para sincronizar eventos');
        if (showToast) {
          toast({
            title: "Agente não encontrado",
            description: "Configure um agente Pri(Ligação) com telefone para sincronizar eventos",
            variant: "destructive"
          });
        }
        // Mostrar todos os eventos de ligação locais como válidos
        const eventosLigacao = prospeccoes.filter(p => 
          String(p.canal).toLowerCase().includes('liga') || 
          p.canal === 'Ligação'
        );
        setEventosLigacaoValidos(new Set(eventosLigacao.map(e => e.id)));
        setEventosLigacaoVerificados(true);
        return;
      }
      
      const telefonePri = String(agenteLigacao.telefone).replace(/\D/g, '');
      
      // Buscar crm_id da empresa para usar como dealer_id
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('crm_id')
        .eq('id', activeCompany.id)
        .single();
      
      const dealerId = empresaData?.crm_id || null;
      
      console.log('🔄 Sincronizando eventos de Ligação com webhook...', { telefonePri, dealerId });
      
      // Chamar edge function de sincronização
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-eventos-ligacao', {
        body: {
          pri_telefone: telefonePri,
          empresa_id: activeCompany.id,
          dealer_id: dealerId,
          dry_run: false
        }
      });
      
      if (syncError) {
        console.error('❌ Erro na sincronização:', syncError);
        if (showToast) {
          toast({
            title: "Erro na sincronização",
            description: syncError.message || "Não foi possível sincronizar eventos",
            variant: "destructive"
          });
        }
      } else {
        console.log('✅ Sincronização concluída:', syncResult);
        
        if (showToast) {
          const summary = syncResult?.summary || {};
          const totalSincronizados = (summary.criados || 0) + (summary.sincronizados_de_eventos_pri || 0);
          toast({
            title: "Sincronização concluída",
            description: `Sincronizados: ${totalSincronizados} | Mantidos: ${summary.mantidos || 0}`,
          });
        }
        
        // Atualizar apenas lista de prospecções (não contatos)
        fetchProspeccoes(globalFilters.showAllEvents);
      }
      
      // Após sincronização, todos os eventos de ligação são válidos (os inválidos foram removidos)
      const eventosLigacaoAtualizados = prospeccoes.filter(p => 
        String(p.canal).toLowerCase().includes('liga') || 
        p.canal === 'Ligação'
      );
      setEventosLigacaoValidos(new Set(eventosLigacaoAtualizados.map(e => e.id)));
      
    } catch (error) {
      console.error('❌ Erro ao sincronizar eventos de Ligação:', error);
      if (showToast) {
        toast({
          title: "Erro",
          description: "Erro ao sincronizar eventos de Ligação",
          variant: "destructive"
        });
      }
      // Fallback: mostrar todos os eventos de ligação
      const eventosLigacao = prospeccoes.filter(p => 
        String(p.canal).toLowerCase().includes('liga') || 
        p.canal === 'Ligação'
      );
      setEventosLigacaoValidos(new Set(eventosLigacao.map(e => e.id)));
    } finally {
      setSincronizandoLigacao(false);
      setLoadingEventosLigacao(false);
      setEventosLigacaoVerificados(true);
    }
  };

  // Sincronizar automaticamente ao carregar a página
  useEffect(() => {
    if (activeCompany?.id && prospeccoes.length > 0 && !sincronizandoLigacao) {
      // Não bloquear - executar em background
      sincronizarEventosLigacao(false);
    }
  }, [activeCompany?.id, prospeccoes.length > 0]);

  // Carregar contatos apenas quando necessário (aba kanban, recepcao, ou vendas)
  // Para vendedores: atribuir leads automaticamente quando entrar na aba de atendimentos
  useEffect(() => {
    if (activeTab !== 'eventos' && activeCompany?.id && !contatosLoaded) {
      console.log('📥 Loading contatos for tab:', activeTab);
      loadContatos();
    }
  }, [activeTab, activeCompany?.id, contatosLoaded, loadContatos]);

  // Atribuir leads automaticamente para vendedores quando acessam a aba de atendimentos
  useEffect(() => {
    if (activeTab === 'kanban' && contatosLoaded && isLimitedUser) {
      console.log('🎯 Vendedor acessou aba de atendimentos - verificando se precisa de leads...');
      verificarEAtribuirSeNecessario().then(() => {
        // Recarregar contatos após atribuição para mostrar os novos leads
        refetch();
      });
    }
  }, [activeTab, contatosLoaded, isLimitedUser, verificarEAtribuirSeNecessario, refetch]);
  useEffect(() => {
    sessionStorage.setItem('prospeccao_active_tab', activeTab);
  }, [activeTab]);

  // Garantir que a popup de Recepção mantém a aba correta
  useEffect(() => {
    if (isRecepcaoModalOpen && activeTab !== 'recepcao') {
      setActiveTab('recepcao');
    }
  }, [isRecepcaoModalOpen, activeTab]);

  // Check URL parameters for recepcao auto-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nome = params.get('nome');
    const telefone = params.get('telefone');
    const campanha = params.get('campanha');
    const empresaId = params.get('empresa_id');
    const idMaia = params.get('id_maia');

    const handleRecepcaoLink = async () => {
      // 1) Após reload: abrir popup somente quando a empresa ativa estiver carregada e correta
      const pending = sessionStorage.getItem('recepcao_pending_data');
      if (pending) {
        const data = JSON.parse(pending);
        // Aguarda carregamento do company context
        if (companyLoading) return;

        // Se a empresa do pending não bate com a ativa, aguardar próximo ciclo
        if (data.empresa_id && activeCompany?.id !== data.empresa_id) {
          return;
        }

        // Empresa correta: abrir modal e limpar pending
        sessionStorage.removeItem('recepcao_pending_data');
        setActiveTab('recepcao'); // Mudar para aba Recepção
        setRecepcaoInitialData({
          nome_cliente: data.nome || '',
          telefone_cliente: data.telefone || '',
          nome_campanha: data.campanha || '',
          id_maia: data.id_maia || ''
        });
        setIsRecepcaoModalOpen(true);
        // Limpar querystring
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      // 2) Primeira chamada via URL: trocar empresa antes de abrir modal
      if (nome || telefone || campanha || empresaId || idMaia) {
        // Se precisa trocar de empresa
        if (empresaId && activeCompany?.id !== empresaId) {
          // Aguardar carregamento
          if (companyLoading) return;
          
          // Salvar dados e aba ativa antes de trocar
          sessionStorage.setItem('recepcao_pending_data', JSON.stringify({
            nome,
            telefone,
            campanha,
            id_maia: idMaia,
            empresa_id: empresaId
          }));
          sessionStorage.setItem('prospeccao_active_tab', 'recepcao');

          try {
            await switchCompany(empresaId);
          } catch (e) {
            console.error('Erro ao trocar empresa (URL):', e);
            sessionStorage.removeItem('recepcao_pending_data');
            sessionStorage.removeItem('prospeccao_active_tab');
            toast({
              title: "Erro ao trocar empresa",
              description: "Não foi possível trocar para a empresa especificada no link.",
              variant: "destructive"
            });
          }
          // Sempre retornar aqui para aguardar reload
          return;
        }

        // Não precisa trocar empresa: só abrir quando empresa estiver carregada
        if (companyLoading) return;

        setActiveTab('recepcao'); // Mudar para aba Recepção
        setRecepcaoInitialData({
          nome_cliente: nome || '',
          telefone_cliente: telefone || '',
          nome_campanha: campanha || '',
          id_maia: idMaia || ''
        });
        setIsRecepcaoModalOpen(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleRecepcaoLink();
  }, [activeCompany, companyLoading, switchCompany, toast]);

  // Função para registrar movimentações dos contatos
  const handleStatusChange = async (itemId: string, fromStatus: string, toStatus: string): Promise<boolean> => {
    console.log('handleStatusChange called:', { itemId, fromStatus, toStatus });
    
    // Se destino é "descartados", abrir modal para preencher motivo e justificativa
    if (toStatus === 'descartados') {
      const contatoCompleto = contatos.find(c => c.id === itemId);
      if (contatoCompleto) {
        setDescarteModal({
          isOpen: true,
          contatoId: itemId,
          contatoNome: contatoCompleto.nome,
          fromStatus: fromStatus
        });
        return false; // Não mover o card visualmente ainda
      }
    }
    
    // Se destino é "venda", verificar campos obrigatórios
    if (toStatus === 'venda') {
      const contatoCompleto = contatos.find(c => c.id === itemId);
      console.log('Moving to venda, contato:', contatoCompleto);
      
      if (contatoCompleto) {
        // Verificar se responsável está preenchido
        const temResponsavel = !!contatoCompleto.responsavel_email;
        
        // Se não tem responsável, atribuir automaticamente o usuário atual
        let responsavelId = contatoCompleto.responsavel_email;
        if (!temResponsavel && user?.id) {
          await atribuirResponsavel(itemId, user.id);
          responsavelId = user.id;
        }
        
        // Verificar se já existe uma venda para este contato (com departamento e produto preenchidos)
        const vendaExistente = vendas.find(v => v.contato_id === itemId && v.departamento_id && v.produto_id);
        
        if (vendaExistente) {
          // Venda já existe com todos os campos, apenas atualizar status
          console.log('Venda já existe, atualizando status apenas');
          await atualizarStatusContato(itemId, 'Venda');
          
          if (registrarMovimentacao && user && prospeccoes?.length > 0) {
            await registrarMovimentacao({
              leadId: itemId,
              prospeccaoId: prospeccoes[0].id,
              statusAnterior: fromStatus,
              statusNovo: toStatus,
              usuarioId: user.id,
            });
          }
          
          toast({
            title: "Status Atualizado",
            description: "Lead movido para Vendas.",
          });
          return true;
        }
        
        // Buscar departamento do responsável (se existir no profile)
        let departamentoId: string | null = null;
        if (responsavelId) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('departamento')
            .eq('id', responsavelId)
            .maybeSingle();
          
          if (profileData?.departamento) {
            // Buscar o ID do departamento pelo nome
            const { data: depData } = await supabase
              .from('departamentos')
              .select('id')
              .eq('empresa_id', activeCompany?.id)
              .eq('nome', profileData.departamento)
              .eq('ativo', true)
              .maybeSingle();
            
            if (depData) {
              departamentoId = depData.id;
            }
          }
        }
        
        // Como departamento e produto são selecionados no modal e não ficam salvos no contato,
        // sempre abrir o modal para confirmar a venda (exceto se já existe uma venda)
        
        // Se falta algum campo obrigatório, abrir modal na aba de produtos
        setModalContato({
          isOpen: true,
          contato: { ...contatoCompleto, responsavel_email: responsavelId },
          columnId: fromStatus,
          requireProdutoVendido: true,
          pendingVendaStatus: { fromStatus, toStatus }
        });
        
        toast({
          title: "Confirmar Venda",
          description: "Selecione o Produto Vendido e Departamento para registrar a venda.",
        });
        return false; // Não mover o card visualmente ainda
      }
    }

    const novoStatusDb = kanbanStatusMap[toStatus as keyof typeof kanbanStatusMap];
    if (novoStatusDb) {
      await atualizarStatusContato(itemId, novoStatusDb);
    }

    // Auto-atribuir responsável quando sair da coluna "novos"
    if (fromStatus === 'novos' && user?.email) {
      await atribuirResponsavel(itemId, user.email);
    }

    if (registrarMovimentacao && user && prospeccoes?.length > 0) {
      await registrarMovimentacao({
        leadId: itemId,
        prospeccaoId: prospeccoes[0].id, 
        statusAnterior: fromStatus,
        statusNovo: toStatus,
        usuarioId: user.id,
      });
    }
    
    return true; // Permitir mover o card
  };

  // Carregar contagens de pendentes para eventos IA (OTIMIZADO - sem webhooks externos)
  // Métricas externas de Ligação são carregadas sob demanda via RPC
  useEffect(() => {
    const carregarContagens = async () => {
      // Somente carregar se estiver na aba de eventos
      if (activeTab !== 'eventos') return;
      
      const eventosIA = prospeccoes.filter(p => {
        const canalStr = String(p.canal).toLowerCase();
        return canalStr === 'whatsapp' || canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
      });

      if (eventosIA.length === 0) return;

      // Usar RPC get_prospeccao_metricas para todos os eventos (muito mais rápido)
      // Carregar em paralelo, batches de 10 para não sobrecarregar
      const batchSize = 10;
      for (let i = 0; i < eventosIA.length; i += batchSize) {
        const batch = eventosIA.slice(i, i + batchSize);
        
        const results = await Promise.all(
          batch.map(async (evento) => {
            try {
              // Usar RPC para métricas rápidas (sem chamar webhooks externos)
              const { data: metricasData } = await supabase
                .rpc('get_prospeccao_metricas' as any, {
                  p_prospeccao_id: evento.id,
                  p_empresa_id: activeCompany?.id
                });

              if (metricasData && Array.isArray(metricasData) && metricasData.length > 0) {
                const m = metricasData[0] as { total: number; pendentes: number; disparados: number; vendas: number };
                return { 
                  id: evento.id, 
                  contagem: {
                    total: Number(m.total) || 0,
                    pendentes: Number(m.pendentes) || 0,
                    disparados: Number(m.disparados) || 0
                  }
                };
              }
              
              return { id: evento.id, contagem: { total: 0, pendentes: 0, disparados: 0 } };
            } catch (error) {
              console.error(`Erro ao buscar métricas para evento ${evento.id}:`, error);
              return { id: evento.id, contagem: { total: 0, pendentes: 0, disparados: 0 } };
            }
          })
        );
        
        setContagemPendentes(prev => {
          const newState = { ...prev };
          results.forEach(r => {
            newState[r.id] = r.contagem;
          });
          return newState;
        });
      }
    };

    if (prospeccoes.length > 0 && activeCompany?.id) {
      carregarContagens();
    }
  }, [prospeccoes, activeCompany?.id, activeTab]);

  // Calcular métricas dos contatos (antes do early return para uso nos useMemo)
  const metricas = getMetricas();

  // ✅ TODOS OS USEMEMO DEVEM VIR ANTES DO EARLY RETURN
  // Função de filtragem global para contatos
  // IMPORTANTE: Para sincronizar com o Funil, mostramos apenas contatos vinculados a eventos
  const filteredContatos = useMemo(() => {
    return contatos.filter(contato => {
      // Regra de sincronização com Funil: contatos devem estar vinculados a pelo menos um evento
      // Isso garante que os números do Kanban correspondam aos do Funil de Vendas
      const prospeccaoIdsDoContato = contatosProspeccoes.get(contato.id);
      
      // Filtro por prospecção/evento específico
      if (globalFilters.prospeccaoId !== "todos") {
        if (!prospeccaoIdsDoContato || !prospeccaoIdsDoContato.has(globalFilters.prospeccaoId)) {
          return false;
        }
      } else {
        // Quando é "todos", mostrar apenas contatos vinculados a pelo menos um evento
        // Isso sincroniza com a lógica do Funil que usa eventos_prospeccao
        if (!prospeccaoIdsDoContato || prospeccaoIdsDoContato.size === 0) {
          return false;
        }
      }
      if (globalFilters.dataInicio) {
        const dataInicio = new Date(globalFilters.dataInicio);
        const contatoData = new Date(contato.created_at || '');
        if (contatoData < dataInicio) return false;
      }
      if (globalFilters.dataFim) {
        const dataFim = new Date(globalFilters.dataFim);
        dataFim.setHours(23, 59, 59, 999);
        const contatoData = new Date(contato.created_at || '');
        if (contatoData > dataFim) return false;
      }
      if (globalFilters.responsavelId !== "todos") {
        const profile = profiles.find(p => p.id === globalFilters.responsavelId);
        if (profile) {
          const matchResponsavel = 
            contato.responsavel_email === profile.id ||
            contato.responsavel_email === profile.email ||
            contato.responsavel_email === profile.celular;
          if (!matchResponsavel) return false;
        } else {
          return false;
        }
      }
      if (globalFilters.status !== "todos" && contato.status !== globalFilters.status) {
        return false;
      }
      // Filtro unificado inteligente: Dados do Lead (nome, telefone, email, id, lead_id)
      // Detecção automática do tipo de busca baseado no conteúdo digitado
      if (globalFilters.dadosLead) {
        const rawSearch = globalFilters.dadosLead.trim();
        if (rawSearch) {
          const searchLower = rawSearch.toLowerCase();
          const searchDigits = rawSearch.replace(/\D/g, "");
          const hasOnlyDigits = /^\d+$/.test(rawSearch);
          const hasOnlyLetters = /^[a-zA-ZÀ-ÿ\s]+$/.test(rawSearch);
          const telefoneDigits = contato.telefone?.replace(/\D/g, "") || "";

          // === MODO NUMÉRICO: Usuário digitou apenas números ===
          if (hasOnlyDigits) {
            // Buscar em TODOS os campos numéricos simultaneamente
            const matchLeadId = contato.lead_id != null && String(contato.lead_id).includes(searchDigits);
            const matchTelefone = telefoneDigits.includes(searchDigits);
            
            // Se não encontrou em nenhum campo numérico, excluir
            if (!matchLeadId && !matchTelefone) return false;
          }
          // === MODO TEXTO: Usuário digitou apenas letras ===
          else if (hasOnlyLetters) {
            // Buscar apenas no nome
            const matchNome = contato.nome?.toLowerCase().includes(searchLower);
            if (!matchNome) return false;
          }
          // === MODO MISTO: Usuário digitou combinação de letras e números ===
          else {
            // Buscar em todos os campos (nome, email, telefone, lead_id)
            const matchNome = contato.nome?.toLowerCase().includes(searchLower);
            const matchEmail = contato.email?.toLowerCase().includes(searchLower);
            const matchId = contato.id?.toLowerCase().includes(searchLower);
            const matchTelefone = searchDigits.length > 0 && telefoneDigits.includes(searchDigits);
            const matchLeadId = searchDigits.length > 0 && contato.lead_id != null && String(contato.lead_id).includes(searchDigits);

            if (!matchNome && !matchTelefone && !matchEmail && !matchId && !matchLeadId) return false;
          }
        }
      }
      return true;
    });
  }, [contatos, globalFilters, profiles, contatosProspeccoes]);

  // Função de filtragem global para prospecções/eventos
  // NOTA: Eventos de Ligação agora são mostrados mesmo sem estar no webhook externo
  // O botão de disparo ficará desabilitado se o evento não tiver event_id_pri válido no webhook
  const filteredProspeccoes = useMemo(() => {
    return prospeccoes.filter(prospeccao => {
      if (globalFilters.prospeccaoId !== "todos" && prospeccao.id !== globalFilters.prospeccaoId) {
        return false;
      }
      if (globalFilters.dataInicio && prospeccao.data_fim) {
        const filtroInicio = new Date(globalFilters.dataInicio);
        const eventoFim = new Date(prospeccao.data_fim);
        if (eventoFim < filtroInicio) return false;
      }
      if (globalFilters.dataFim && prospeccao.data_inicio) {
        const filtroFim = new Date(globalFilters.dataFim);
        const eventoInicio = new Date(prospeccao.data_inicio);
        if (eventoInicio > filtroFim) return false;
      }
      if (globalFilters.dadosLead) {
        const search = globalFilters.dadosLead.toLowerCase();
        if (!prospeccao.titulo?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [prospeccoes, globalFilters]);


  // ✅ AGORA EARLY RETURN PODE VIR APÓS TODOS OS HOOKS
  if (loading) {
    return (
      <DashboardLayout title="Prospecção">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  // Dados para o novo layout da Visão Geral
  const visaoGeralMetrics = {
    ativosNaProspeccao: metricas.totalBase,
    disponiveisDistribuicao: metricas.disponiveisDistribuicao,
    emEspera: metricas.emEspera,
    descartados: metricas.descartados,
    paraExclusao: metricas.optOut
  };

  const funnelDataNew = {
    novos: metricas.novos,
    distribuidosSemAcao: metricas.atribuidos,
    contatados: metricas.convidados,
    semContato: metricas.emEspera,
    convidados: metricas.convidados,
    confirmados: metricas.confirmados,
    checkIns: metricas.checkin,
    vendas: metricas.vendas
  };

  // Dados mock para histórico (implementar busca real depois)
  const historicoImportacao: any[] = [];
  
  // Dados de clientes por usuário (baseado em responsavel_email que pode ser ID, email ou celular)
  const getClientesPorUsuario = () => {
    const usuariosMap = new Map<string, { nome: string; tipoAcesso: string; novos: number; atribuidos: number; emEspera: number; convidados: number }>();
    
    contatos.forEach(contato => {
      const responsavel = contato.responsavel_email || 'nao_atribuido';
      
      // Buscar profile correspondente pelo ID, EMAIL ou CELULAR
      // Apenas buscar se responsavel não for 'nao_atribuido'
      const profile = responsavel !== 'nao_atribuido' ? profiles.find(p => 
        p.id === responsavel ||
        p.email === responsavel || 
        (p.celular && p.celular.length > 0 && p.celular === responsavel) ||
        // Tentar match sem formatação (apenas dígitos) - apenas se ambos tiverem valor
        (p.celular && p.celular.length > 0 && responsavel.length > 0 && 
         p.celular.replace(/\D/g, '') === responsavel.replace(/\D/g, ''))
      ) : undefined;
      
      // Usar o ID do profile como chave para evitar duplicatas quando o mesmo usuário
      // é referenciado por diferentes identificadores (UUID, email, celular)
      const mapKey = profile?.id || responsavel;
      
      const current = usuariosMap.get(mapKey) || { 
        nome: profile?.nome_completo || (responsavel === 'nao_atribuido' ? 'Não atribuído' : responsavel), 
        tipoAcesso: profile?.tipo_acesso || '-',
        novos: 0, 
        atribuidos: 0, 
        emEspera: 0, 
        convidados: 0 
      };
      
      if (contato.status === 'Novo') current.novos++;
      if (contato.status === 'Atribuído') current.atribuidos++;
      if (contato.status === 'Em Espera') current.emEspera++;
      if (contato.status === 'Convidado') current.convidados++;
      
      usuariosMap.set(mapKey, current);
    });

    return Array.from(usuariosMap.entries()).map(([key, data]) => ({
      id: key,
      nome: data.nome,
      tipoAcesso: data.tipoAcesso,
      totalClientes: data.novos + data.atribuidos + data.emEspera + data.convidados,
      novos: data.novos,
      atribuidos: data.atribuidos,
      emEspera: data.emEspera,
      convidados: data.convidados
    }));
  };

  // Converter contatos para itens do Kanban
  const contatosToKanbanItems = (contatosLista: typeof contatos): KanbanItem[] => {
    if (!contatosLista || !Array.isArray(contatosLista)) return [];
    
    return contatosLista
      .filter(contato => contato && contato.nome)
      .map(contato => {
        const prospeccaoNome = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].titulo : 'Sem prospecção';
        const prospeccaoCanal = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].canal : 'Whatsapp';
        
        // Mapear responsavel_email (que contém o ID do usuário) para o nome completo
        let assigneeName: string | undefined = undefined;
        if (contato.responsavel_email) {
          // responsavel_email pode conter tanto ID quanto email - tentar ambos
          const responsavelProfile = profiles.find(p => 
            p.id === contato.responsavel_email || p.email === contato.responsavel_email
          );
          assigneeName = responsavelProfile?.nome_completo || undefined;
        }
        
        return {
          id: contato.id || '',
          lead_id: contato.lead_id,
          title: contato.nome || 'Sem nome',
          description: contato.observacoes || undefined,
          channel: contato.telefone || '',
          tags: contato.origem ? [contato.origem] : undefined,
          dueDate: contato.created_at || undefined,
          assignee: assigneeName,
          prospeccaoNome,
          prospeccaoCanal,
          segmentacao: 'Undefined'
        };
      });
  };

  // Configurar colunas do Kanban com dados filtrados globalmente
  const kanbanColumns: KanbanColumnData[] = [
    {
      id: 'novos',
      title: 'Novos',
      color: '#6645EB',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Novo')) : []
    },
    {
      id: 'atribuidos',
      title: 'Atribuídos',
      color: '#8B5FD6',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Atribuído')) : []
    },
    {
      id: 'emespera',
      title: 'Em Espera',
      color: '#F59E0B',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Em Espera')) : []
    },
    {
      id: 'convidados',
      title: 'Convidados',
      color: '#A679E1',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Convidado')) : []
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Confirmado')) : []
    },
    {
      id: 'checkin',
      title: 'Check-ins',
      color: '#22c55e',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Check-in')) : []
    },
    {
      id: 'venda',
      title: 'Vendas',
      color: '#16a34a',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Venda')) : []
    },
    {
      id: 'descartados',
      title: 'Descartados',
      color: '#ef4444',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Descartado')) : []
    },
    {
      id: 'optout',
      title: 'Opt Out',
      color: '#6B7280',
      items: filteredContatos ? contatosToKanbanItems(filteredContatos.filter(contato => contato && contato.status === 'Opt Out')) : []
    }
  ];

  // Função para determinar origem baseada no canal do evento
  const getOrigemFromProspeccao = (prospeccao: any): 'WhatsApp' | 'ligacao' | 'grande_evento' | 'prospeccao_mensal' | 'Outros' => {
    // Verificar pelo título ou canal para determinar o tipo de evento
    const titulo = prospeccao.titulo?.toLowerCase() || '';
    const canal = prospeccao.canal;
    
    if (canal === 'Ligação') {
      return 'ligacao';
    } else if (titulo.includes('grande evento') || prospeccao.premio_equipe_campea != null) {
      return 'grande_evento';
    } else if (titulo.includes('prospecção mensal') || titulo.includes('prospeccao mensal')) {
      return 'prospeccao_mensal';
    } else if (canal === 'Whatsapp') {
      return 'WhatsApp';
    }
    return 'Outros';
  };

  // Função para importar clientes como contatos
  // Retorna resultado detalhado para que UploadPlanilha mostre feedback preciso
  const handleClientesImported = async (prospeccaoId: string, clientes: ClienteData[]): Promise<{
    eventosInseridos: number;
    eventosErros: number;
    novosContatosCriados: number;
    existentesVinculados: number;
    jaNoEvento: number;
    insertErrors: number;
    totalEnviados: number;
  }> => {
    try {
      console.log('=== INICIANDO IMPORTAÇÃO ===');
      console.log('Prospeccao ID:', prospeccaoId);
      console.log('Quantidade de clientes:', clientes.length);

      const prospeccaoSelecionada = prospeccoes.find(p => p.id === prospeccaoId);
      if (!prospeccaoSelecionada) {
        throw new Error(`Prospecção (id: ${prospeccaoId}) não encontrada`);
      }

      const origemContato = getOrigemFromProspeccao(prospeccaoSelecionada);

      const novosContatos = clientes.map(cliente => ({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email || undefined,
        origem: origemContato,
        observacoes: `Importado para o evento: ${prospeccaoSelecionada.titulo}`,
        responsavel_email: cliente.responsavel && cliente.responsavel.trim() ? cliente.responsavel : undefined,
        base_id: cliente.base_id
      }));

      const isLigacaoEvent = prospeccaoSelecionada.canal === 'Ligação';

      // ETAPA 1: Criar contatos no banco local (com timeout de segurança de 120s)
      let resultado: Awaited<ReturnType<typeof adicionarContatos>> | undefined;
      try {
        const adicionarPromise = adicionarContatos(novosContatos, prospeccaoSelecionada.id);
        const timeoutPromise = new Promise<undefined>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao adicionar contatos (120s)')), 120000)
        );
        resultado = await Promise.race([adicionarPromise, timeoutPromise]) as typeof resultado;
      } catch (adicionarError) {
        console.error('❌ Erro/timeout ao adicionar contatos:', adicionarError);
        throw adicionarError;
      }

      console.log('📊 Resultado do adicionarContatos:', {
        eventosInseridos: resultado?.eventosInseridos,
        eventosErros: resultado?.eventosErros,
        novos: resultado?.novosContatosCriados?.length,
        vinculados: resultado?.contatosVinculados?.length,
        jaNoEvento: resultado?.jaVinculados?.length,
      });

      // ETAPA 2: Para eventos de Ligação, sincronizar com sistema externo
      if (isLigacaoEvent) {
        try {
          console.log('📞 [SYNC] Iniciando sincronização com sistema externo de ligação...');
          
          const { data: agenteData, error: agenteError } = await supabase
            .from('agente_empresas')
            .select(`
              agente_id,
              agentes_ia (
                id,
                nome,
                telefone,
                ativo
              )
            `)
            .eq('empresa_id', activeCompany?.id)
            .limit(10);
          
          const agenteAtivo = agenteData?.find(a => a.agentes_ia?.ativo === true && a.agentes_ia?.telefone);

          if (agenteError || !agenteAtivo?.agentes_ia?.telefone) {
            console.warn('⚠️ [SYNC] Nenhum agente Pri encontrado');
          } else {
            const telefonePri = agenteAtivo.agentes_ia.telefone.replace(/\D/g, '');
            const lojaNome = activeCompany?.nome_empresa || '';
            const idEvento = prospeccaoSelecionada.event_id_pri ? Number(prospeccaoSelecionada.event_id_pri) : null;

            const normalizeTelefoneForPri = (digits: string) => {
              if (digits.length > 11 && digits.startsWith('55')) return digits.slice(2);
              return digits;
            };

            const contatosPayload = clientes.map((c) => {
              const telefoneDigitsRaw = c.telefone?.replace(/\D/g, '') || '';
              const telefoneDigits = normalizeTelefoneForPri(telefoneDigitsRaw);
              return { nome: c.nome || '', telefone: telefoneDigits };
            });

            const SYNC_BATCH = 1000;
            for (let i = 0; i < contatosPayload.length; i += SYNC_BATCH) {
              const batch = contatosPayload.slice(i, i + SYNC_BATCH);
              try {
                await supabase.functions.invoke('create-base-ligacao', {
                  body: {
                    contatos: batch,
                    id_evento: idEvento || 0,
                    telefone_pri: telefonePri,
                    empresa_id: activeCompany?.id,
                    prospeccao_id: prospeccaoSelecionada.id,
                    loja: lojaNome,
                    sync_external: !!idEvento,
                  },
                });
              } catch (batchError) {
                console.error(`❌ [SYNC] Exceção no lote:`, batchError);
              }
            }
          }
        } catch (createBaseError) {
          console.error('❌ Erro ao criar base de ligação:', createBaseError);
        }
      }

      // Forçar atualização dos dados
      refetch();

      return {
        eventosInseridos: resultado?.eventosInseridos ?? 0,
        eventosErros: resultado?.eventosErros ?? 0,
        novosContatosCriados: resultado?.novosContatosCriados?.length ?? 0,
        existentesVinculados: resultado?.contatosVinculados?.length ?? 0,
        jaNoEvento: resultado?.jaVinculados?.length ?? 0,
        insertErrors: resultado?.insertErrors ?? 0,
        totalEnviados: clientes.length,
      };

    } catch (error: any) {
      console.error('Erro ao importar contatos:', error);
      throw error;
    }
  };

  const handleClientesSelected = async (prospeccaoId: string, clientes: ClienteData[]) => {
    // BaseExistente já faz a vinculação diretamente no banco
    // Este callback é chamado apenas para atualizar os dados locais
    try {
      console.log(`✅ ${clientes.length} clientes vinculados ao evento ${prospeccaoId} via BaseExistente`);
      
      // Atualizar dados locais
      refetch();
    } catch (error: any) {
      console.error('Erro ao atualizar dados:', error);
    }
  };

  const handleProspectionSelection = (prospectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedProspections(prev => [...prev, prospectionId]);
    } else {
      setSelectedProspections(prev => prev.filter(id => id !== prospectionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProspections(prospeccoes.map(p => p.id));
    } else {
      setSelectedProspections([]);
    }
  };

  const handleAddItem = (columnId: string, item: Omit<KanbanItem, 'id'>) => {
    // Abrir modal para adicionar contato detalhado ao invés de criar básico
    setModalContato({
      isOpen: true,
      contato: null, // Null indica novo contato
      columnId: columnId
    });
  };

  const handleEditItem = (item: KanbanItem) => {
    console.log('Edit item:', item);
  };

  const handleDeleteItem = (itemId: string) => {
    // TODO: Implementar exclusão do contato no banco
    console.log('Delete item:', itemId);
  };

  const handleCardClick = (item: KanbanItem) => {
    // Buscar o contato completo pelo ID do item
    const contatoCompleto = contatos.find(c => c.id === item.id);
    if (contatoCompleto) {
      // Encontrar a coluna do item para passar como contexto
      const coluna = kanbanColumns.find(col => 
        col.items.some(kanbanItem => kanbanItem.id === item.id)
      );
      
      setModalContato({
        isOpen: true,
        contato: contatoCompleto,
        columnId: coluna?.id
      });
    }
  };

  const handleCloseModal = () => {
    setModalContato({ isOpen: false, contato: null, columnId: undefined, requireProdutoVendido: false, pendingVendaStatus: undefined });
  };

  // Handler para confirmar venda com produto
  const handleConfirmVenda = async (contatoId: string, produtoVendidoId: string, departamentoId?: string, responsavelId?: string) => {
    // Get the contato data for creating sale
    const contato = contatos.find(c => c.id === contatoId);
    if (!contato) return;
    
    // Se tem pendingVendaStatus, estamos vindo de drag-and-drop e precisamos atualizar o status
    if (modalContato.pendingVendaStatus) {
      const { fromStatus, toStatus } = modalContato.pendingVendaStatus;
      const novoStatusDb = kanbanStatusMap[toStatus as keyof typeof kanbanStatusMap];
      
      if (novoStatusDb) {
        await atualizarStatusContato(contatoId, novoStatusDb);
      }

      // Auto-atribuir responsável quando sair da coluna "novos"
      if (fromStatus === 'novos' && user?.email) {
        await atribuirResponsavel(contatoId, user.email);
      }

      if (registrarMovimentacao && user && prospeccoes?.length > 0) {
        await registrarMovimentacao({
          leadId: contatoId,
          prospeccaoId: prospeccoes[0].id, 
          statusAnterior: fromStatus,
          statusNovo: toStatus,
          usuarioId: user.id,
          observacoes: `Produto vendido: ${produtoVendidoId}`
        });
      }
    } else {
      // Se não tem pendingVendaStatus, o contato já está em status de venda
      // Apenas verificar e garantir que está em Venda
      if (contato.status !== 'Venda') {
        await atualizarStatusContato(contatoId, 'Venda');
      }
    }

    // Find prospeccao for this contact (use the first one for now, or from filters)
    const prospeccaoId = globalFilters.prospeccaoId !== 'todos' && globalFilters.prospeccaoId 
      ? globalFilters.prospeccaoId 
      : prospeccoes[0]?.id;

    // Create the sale record automatically
    if (prospeccaoId) {
      try {
        await criarVenda({
          prospeccaoId,
          contatoId,
          clienteNome: contato.nome,
          clienteTelefone: contato.telefone || null,
          responsavelId: responsavelId || user?.id || null,
          produtoId: produtoVendidoId,
          departamentoId: departamentoId || null,
        });
        
        // Refresh vendas list
        await refetchVendas();
        
        toast({
          title: "Venda Registrada",
          description: "A venda foi registrada com sucesso.",
        });
      } catch (error) {
        console.error('Erro ao criar venda:', error);
        toast({
          title: "Erro ao criar venda",
          description: "Não foi possível registrar a venda. Tente novamente.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Erro",
        description: "Nenhuma prospecção selecionada para registrar a venda.",
        variant: "destructive"
      });
    }

    handleCloseModal();
  };

  const handleModalStatusChange = async (contatoId: string, novoStatus: Contato['status']) => {
    await atualizarStatusContato(contatoId, novoStatus);
    
    // Registrar movimentação se necessário
    if (registrarMovimentacao && user) {
      const contato = contatos.find(c => c.id === contatoId);
      if (contato) {
        await registrarMovimentacao({
          leadId: contatoId,
          prospeccaoId: prospeccoes[0]?.id || 'default',
          statusAnterior: contato.status,
          statusNovo: novoStatus,
          usuarioId: user.id,
        });
      }
    }
  };

  const handleModalDelete = async (contatoId: string) => {
    // Admin e TI podem forçar exclusão de contatos com vínculos
    await excluirContato(contatoId, isAdminOrTI);
  };

  const handleModalAssignResponsible = async (contatoId: string, userId: string) => {
    await atribuirResponsavel(contatoId, userId);
  };

  // FAB Handlers
  const handleNovoLead = () => {
    setIsNovoLeadModalOpen(true);
  };

  const handleNovoCheckin = () => {
    // Abrir modal de recepção para registrar check-in
    setRecepcaoInitialData(null);
    setIsRecepcaoModalOpen(true);
  };

  const handleNovaVenda = () => {
    // Abrir modal de novo lead mas para venda (mesmo fluxo, status final será Venda)
    setIsNovoLeadModalOpen(true);
  };

  const handleOpenContatoFromFab = (contato: Contato) => {
    setModalContato({
      isOpen: true,
      contato: contato,
      columnId: undefined,
      requireProdutoVendido: false,
      pendingVendaStatus: undefined
    });
  };

  const solicitarClientes = async () => {
    if (!user) return;

    try {
      // Para vendedores/SDR: usar atribuição automática via RPC (máximo 30)
      if (isLimitedUser) {
        const leadsAtribuidos = await atribuirLeadsAutomaticamente(true);
        
        if (leadsAtribuidos > 0) {
          // Recarregar contatos para mostrar os novos leads
          await refetch();
        }
        return;
      }

      // Para gestores: manter comportamento antigo (manual)
      // Verificar se o usuário tem contatos na coluna "Atribuídos" (status 'Atribuído')
      const contatosAtribuidos = contatos.filter(
        contato => contato && contato.status === 'Atribuído' && contato.responsavel_email === user.email
      );

      if (contatosAtribuidos.length > 0) {
        toast({
          title: "Não é possível solicitar clientes",
          description: `Você possui ${contatosAtribuidos.length} cliente(s) parado(s) na coluna Atribuídos. Finalize o atendimento antes de solicitar novos clientes.`,
          variant: "destructive"
        });
        return;
      }

      // Buscar contatos não atribuídos (status 'Novo' e sem responsável)
      const contatosNovos = contatos.filter(
        contato => contato && contato.status === 'Novo' && !contato.responsavel_email
      );

      if (contatosNovos.length === 0) {
        toast({
          title: "Nenhum cliente disponível",
          description: "Não há clientes novos disponíveis para atribuição no momento.",
          variant: "destructive"
        });
        return;
      }

      // Atribuir até 5 clientes para o usuário (gestores)
      const clientesParaAtribuir = contatosNovos.slice(0, 5);
      
      for (const contato of clientesParaAtribuir) {
        await atribuirResponsavel(contato.id, user.email!);
        // Mover para coluna "Atribuídos" (status 'Atribuído')
        await atualizarStatusContato(contato.id, 'Atribuído');
      }

      toast({
        title: "Clientes atribuídos",
        description: `${clientesParaAtribuir.length} cliente(s) foram atribuídos para você e movidos para a coluna Atribuídos.`,
      });

    } catch (error) {
      console.error('Erro ao solicitar clientes:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao solicitar clientes. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Handlers para editar e excluir prospecção
  const handleEditProspeccao = (prospeccao: any) => {
    setEditingProspeccao(prospeccao);
    setIsModalOpen(true);
  };

  // Handler para excluir prospecção (apenas Grande Evento e Mensal, apenas Admin/TI)
  const handleDeleteProspeccao = async () => {
    if (!deleteEventoModal.prospeccao) return;
    
    setDeletingEvento(true);
    try {
      await excluirProspeccao(deleteEventoModal.prospeccao.id);
      toast({
        title: "Evento excluído",
        description: `O evento "${deleteEventoModal.prospeccao.titulo}" foi excluído com sucesso.`,
      });
      setDeleteEventoModal({ isOpen: false, prospeccao: null });
      refetch();
    } catch (error: any) {
      console.error('Erro ao excluir evento:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o evento",
        variant: "destructive"
      });
    } finally {
      setDeletingEvento(false);
    }
  };


  // Handler para disparar leads para IA - agora abre modal de custo primeiro
  const handleDispararParaIA = async (prospeccaoId: string, canal: string) => {
    const canalStr = String(canal).toLowerCase();
    const isIA = canalStr === 'whatsapp' || canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
    
    if (!isIA) {
      toast({
        title: "Atenção",
        description: "Este evento não é do tipo IA Whatsapp ou IA Ligação.",
        variant: "destructive"
      });
      return;
    }

    // Buscar contagem de pendentes para exibir no modal de custo
    const contagem = contagemPendentes[prospeccaoId] || await contarContatosPendentesDisparo(prospeccaoId);
    const prospeccaoObj = prospeccoes.find(p => p.id === prospeccaoId);
    
    setCustoModal({
      isOpen: true,
      prospeccaoId,
      eventoNome: prospeccaoObj?.titulo || 'Evento',
      canal: canal,
      totalContatos: contagem.pendentes || 0,
    });
  };

  // Executar disparo real após confirmação no modal de custo
  const executarDisparo = async () => {
    const { prospeccaoId } = custoModal;
    setCustoModal(prev => ({ ...prev, isOpen: false }));
    
    setDisparandoIA(prospeccaoId);
    try {
      const resultado = await dispararParaIA(prospeccaoId);
      setContagemPendentes(prev => ({
        ...prev,
        [prospeccaoId]: { total: resultado.total, pendentes: 0, disparados: resultado.total }
      }));
    } finally {
      setDisparandoIA(null);
    }
  };

  return (
    <DashboardLayout title="Prospecção">
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        // Reset showAdicionarClientes quando mudar de aba
        if (value !== 'eventos') setShowAdicionarClientes(false);
      }} className="flex flex-col h-full w-full">
        {/* Sub-módulo Eventos e Atendimentos: sem barra de abas */}
        {!defaultTab && (
          <TabsList className="inline-flex self-start">
            {/* Fallback: mostrar todas as abas se não tiver defaultTab */}
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="automacao">Adicionar Clientes</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="recepcao">Recepção</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
          </TabsList>
        )}

        {/* Filtro Global Unificado com Toggle para Atendimentos */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between min-w-0 w-full">
          <ProspeccaoGlobalFilter
            className="min-w-0 flex-1"
            prospeccoes={prospeccoes.map(p => ({ id: p.id, titulo: p.titulo }))}
            responsaveis={profiles.map(p => ({ id: p.id, nome_completo: p.nome_completo, tipo_acesso: p.tipo_acesso }))}
            filters={globalFilters}
            onFiltersChange={setGlobalFilters}
          />
          
          {/* Toggle Kanban/Lista para sub-módulo Atendimentos */}
          {defaultTab === 'atendimento' && (
            <div className="flex justify-end lg:justify-start">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(value) => {
                  if (value) {
                    setViewMode(value as 'kanban' | 'lista');
                    setActiveTab(value);
                  }
                }}
                className="bg-muted rounded-lg p-0.5 shrink-0"
              >
                <ToggleGroupItem 
                  value="kanban" 
                  aria-label="Visualização Kanban"
                  className="px-3 py-1.5 rounded-md data-[state=on]:font-bold data-[state=on]:border-b-2 data-[state=on]:border-primary"
                >
                  <LayoutGrid className="h-4 w-4 mr-1.5" />
                  Kanban
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="lista" 
                  aria-label="Visualização Lista"
                  className="px-3 py-1.5 rounded-md data-[state=on]:font-bold data-[state=on]:border-b-2 data-[state=on]:border-primary"
                >
                  <List className="h-4 w-4 mr-1.5" />
                  Lista
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>

        <TabsContent value="visao-geral" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-3 pb-6">
              <ProspeccaoVisaoGeral
                metrics={visaoGeralMetrics}
                funnelData={funnelDataNew}
                onImportarLeads={() => setActiveTab('automacao')}
                onHistoricoImportacao={() => setIsHistoricoModalOpen(true)}
                onClientesPorUsuario={() => setIsClientesPorUsuarioModalOpen(true)}
                onMetricClick={(metricType) => {
                  console.log('Metric clicked:', metricType);
                  // Pode navegar para filtro específico no Kanban
                }}
              />
            </div>
          </ScrollIndicator>
        </TabsContent>

        <TabsContent value="eventos" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-3 pb-6">
              {/* Conteúdo condicional: Lista de Eventos ou Adicionar Clientes */}
              {!showAdicionarClientes ? (
                <Card className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-foreground">Lista de Eventos</h3>
                      <span className="text-sm text-muted-foreground">
                        {filteredProspeccoes.length} {filteredProspeccoes.length === 1 ? 'evento' : 'eventos'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {canCreateEventos && (
                        <Button onClick={() => setIsModalOpen(true)} size="sm">
                          <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Criar Evento</span>
                          <span className="sm:hidden">Criar</span>
                        </Button>
                      )}
                      {canUploadBase && (
                        <Button onClick={() => setShowAdicionarClientes(true)} size="sm" variant="outline">
                          <Users className="w-4 h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Adicionar Clientes</span>
                          <span className="sm:hidden">Clientes</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {prospeccoes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="mx-auto h-12 w-12 mb-3 opacity-50" />
                      <p>Nenhum evento cadastrado</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Título</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Data Início</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Data Fim</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Canal</th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Meta Vendas</th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Premiações</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Status</th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProspeccoes
                            .map((prospeccao) => {
                              // Determinar status baseado no estado do disparo
                              const contagem = contagemPendentes[prospeccao.id];
                              const total = contagem?.total || 0;
                              const pendentes = contagem?.pendentes || 0;
                              const disparados = contagem?.disparados || 0;
                              const isDisparandoEvento = disparandoIA === prospeccao.id;
                              
                              // Verificar se evento está desativado (apenas para IA Ligação)
                              const canalStrCheck = String(prospeccao.canal).toLowerCase();
                              const isIALigacaoCheck = canalStrCheck.includes('liga') || canalStrCheck === 'ligação' || canalStrCheck === 'ligacao';
                              const eventoDesativado = isIALigacaoCheck && (prospeccao as any).ativo === false;
                              
                              let status = 'Pendente';
                              let statusColor = 'bg-yellow-100 text-yellow-700';
                              
                              if (eventoDesativado) {
                                // Evento desativado
                                status = 'Desativado';
                                statusColor = 'bg-red-100 text-red-700';
                              } else if (isDisparandoEvento) {
                                // Está disparando agora
                                status = 'Em Progresso';
                                statusColor = 'bg-blue-100 text-blue-700';
                              } else if (total > 0 && pendentes === 0) {
                                // Todos os contatos foram disparados
                                status = 'Encerrado';
                                statusColor = 'bg-gray-100 text-gray-700';
                              } else if (disparados > 0 && pendentes > 0) {
                                // Alguns disparados, mas ainda há pendentes - consideramos "Em Progresso"
                                status = 'Em Progresso';
                                statusColor = 'bg-blue-100 text-blue-700';
                              }
                            
                            // Calcular meta total de vendas
                            const metaTotalVendas = (prospeccao.meta_novos || 0) + (prospeccao.meta_seminovos || 0) + (prospeccao.meta_diretas || 0);
                            
                            // Calcular total de premiações
                            const totalPremiacoes = [
                              prospeccao.premio_equipe_campea,
                              prospeccao.premio_equipe_2lugar,
                              prospeccao.premio_equipe_3lugar,
                              prospeccao.premio_vendedor_ouro,
                              prospeccao.premio_vendedor_prata,
                              prospeccao.premio_vendedor_bronze,
                              prospeccao.premio_prospector_ouro,
                              prospeccao.premio_prospector_prata,
                              prospeccao.premio_prospector_bronze,
                              prospeccao.premio_checkin_ouro,
                              prospeccao.premio_checkin_prata,
                              prospeccao.premio_checkin_bronze,
                              prospeccao.premio_participacao_apoio,
                              prospeccao.premio_indicacao_venda,
                            ].reduce((acc, val) => acc + (val || 0), 0);
                            
                            return (
                              <tr key={prospeccao.id} className="border-b hover:bg-muted/50 transition-colors">
                                <td className="py-3 px-3">
                                  <span className="font-medium text-sm">{prospeccao.titulo}</span>
                                </td>
                                <td className="py-3 px-3 text-sm text-muted-foreground">
                                  {prospeccao.data_inicio 
                                    ? (() => {
                                        const [year, month, day] = prospeccao.data_inicio.split('T')[0].split('-');
                                        return `${day}/${month}/${year}`;
                                      })()
                                    : '-'}
                                </td>
                                <td className="py-3 px-3 text-sm text-muted-foreground">
                                  {prospeccao.data_fim 
                                    ? (() => {
                                        const [year, month, day] = prospeccao.data_fim.split('T')[0].split('-');
                                        return `${day}/${month}/${year}`;
                                      })()
                                    : '-'}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                    {prospeccao.canal}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <span className="font-medium text-sm">{metaTotalVendas > 0 ? metaTotalVendas : '-'}</span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <span className="font-medium text-sm text-amber-600">
                                    {totalPremiacoes > 0 ? totalPremiacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                                    {status}
                                  </span>
                                </td>
                                {/* Coluna de Ações */}
                                <td className="py-3 px-3 text-right">
                                  {(() => {
                                    const canalStr = String(prospeccao.canal).toLowerCase();
                                    const isIAWhatsApp = canalStr === 'whatsapp';
                                    const isIALigacao = canalStr.includes('liga') || canalStr === 'ligação' || canalStr === 'ligacao';
                                    const isIA = isIAWhatsApp || isIALigacao;
                                    const contagem = contagemPendentes[prospeccao.id];
                                    const pendentes = contagem?.pendentes || 0;
                                    const isDisparando = disparandoIA === prospeccao.id;
                                    
                                    // Para eventos de Ligação, verificar se tem event_id_pri configurado
                                    const ligacaoValidoNoWebhook = !isIALigacao || !!prospeccao.event_id_pri;
                                    
                                    return (
                                      <div className="flex items-center justify-end gap-2">

                                        {/* Botão Ver Base */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/prospeccao/eventos/${prospeccao.id}/base`)}
                                          className="h-8 text-xs"
                                        >
                                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                                          Ver Base
                                        </Button>

                                        {/* Menu de ações - sempre mostra para todos os eventos */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem 
                                              onClick={() => navigate(`/prospeccao/eventos/${prospeccao.id}/base`)}
                                            >
                                              <Eye className="mr-2 h-4 w-4" />
                                              Ver Base Importada
                                            </DropdownMenuItem>
                                            {isIA && pendentes > 0 && ligacaoValidoNoWebhook && (
                                              <DropdownMenuItem 
                                                onClick={() => handleDispararParaIA(prospeccao.id, prospeccao.canal || '')}
                                                disabled={isDisparando}
                                                className="text-blue-600"
                                              >
                                                {isIALigacao ? (
                                                  <Phone className="mr-2 h-4 w-4" />
                                                ) : (
                                                  <Send className="mr-2 h-4 w-4" />
                                                )}
                                                Disparar {isIALigacao ? 'Ligações' : 'WhatsApp'} ({pendentes} pendentes)
                                              </DropdownMenuItem>
                                            )}
                                            {isIALigacao && pendentes > 0 && !ligacaoValidoNoWebhook && (
                                              <DropdownMenuItem 
                                                disabled
                                                className="text-muted-foreground opacity-50"
                                              >
                                                <Phone className="mr-2 h-4 w-4" />
                                                Evento não configurado no sistema de Ligação
                                              </DropdownMenuItem>
                                            )}
                                            {/* Toggle Ativar/Desativar para IA Ligação - APENAS Admin/TI */}
                                            {isIALigacao && ligacaoValidoNoWebhook && isAdminOrTI && (
                                              <DropdownMenuItem 
                                                onClick={async () => {
                                                  const eventoAtivo = (prospeccao as any).ativo !== false;
                                                  try {
                                                    await toggleEventoLigacaoAtivo(prospeccao.id, !eventoAtivo);
                                                    toast({
                                                      title: eventoAtivo ? "Evento desativado" : "Evento ativado",
                                                      description: `O evento "${prospeccao.titulo}" foi ${eventoAtivo ? 'desativado' : 'ativado'} com sucesso.`,
                                                    });
                                                    refetch();
                                                  } catch (error: any) {
                                                    toast({
                                                      title: "Erro",
                                                      description: error.message || "Não foi possível alterar o status do evento",
                                                      variant: "destructive"
                                                    });
                                                  }
                                                }}
                                                className={(prospeccao as any).ativo === false ? "text-green-600" : "text-amber-600"}
                                              >
                                                {(prospeccao as any).ativo === false ? (
                                                  <>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Ativar Evento
                                                  </>
                                                ) : (
                                                  <>
                                                    <Target className="mr-2 h-4 w-4" />
                                                    Desativar Evento
                                                  </>
                                                )}
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => handleEditProspeccao(prospeccao)}>
                                              <Edit className="mr-2 h-4 w-4" />
                                              Editar
                                            </DropdownMenuItem>
                                            {/* Botão Excluir - apenas Admin/TI/Master */}
                                            {isAdminOrTI && (
                                              <DropdownMenuItem 
                                                onClick={() => setDeleteEventoModal({ isOpen: true, prospeccao })}
                                                className="text-destructive focus:text-destructive"
                                              >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Excluir Evento
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ) : (
                /* Conteúdo de Adicionar Clientes */
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAdicionarClientes(false)}
                      className="p-1 h-8 w-8"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-base font-semibold text-foreground">Adicionar Clientes à Prospecção</h3>
                  </div>
                  
                  {/* Contador de Clientes */}
                  {contatos.length > 0 && (
                    <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="text-green-600" size={18} />
                        <div>
                          <p className="font-medium text-green-800 text-sm">
                            {contatos.length} clientes cadastrados no sistema
                          </p>
                          <p className="text-xs text-green-600">
                            Todos os clientes estão disponíveis no Kanban para gestão
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Carga de Clientes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <BaseExistente 
                          onClientesSelected={handleClientesSelected}
                          prospeccoes={prospeccoes}
                        />
                        <UploadPlanilha 
                          onImportComplete={() => refetch()}
                          prospeccoes={prospeccoes}
                        />
                      </div>
                    </div>

                    {/* Lista de clientes importados */}
                    <ClientesImportadosList
                      contatos={contatos}
                      prospeccoes={prospeccoes}
                      prospeccaoId={globalFilters.prospeccaoId !== "todos" ? globalFilters.prospeccaoId : undefined}
                      onEditContato={(contato) => {
                        setModalContato({
                          isOpen: true,
                          contato: contato,
                          columnId: undefined
                        });
                      }}
                      onDeleteContato={(id) => excluirContato(id, isAdminOrTI)}
                      onDeleteMultiplosContatos={(ids) => excluirContatosEmMassa(ids, undefined, isAdminOrTI)}
                      onDeleteAllContatos={() => excluirTodosContatosDaEmpresa(isAdminOrTI)}
                      onReenviarGatilhos={reenviarGatilhos}
                      onUpdateContato={atualizarContato}
                      canDelete={isAdminOrTI}
                    />
                  </div>
                </Card>
              )}
            </div>
          </ScrollIndicator>
        </TabsContent>

        <TabsContent value="kanban" className="mt-0 w-full min-w-0 overflow-hidden">
          <div className="h-[calc(100vh-220px)] w-full min-w-0 overflow-hidden">
            {loadingContatos ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Carregando leads...</p>
                </div>
              </div>
            ) : (
              <KanbanBoard
                columns={kanbanColumns}
                onUpdateColumns={() => {}}
                onCardClick={handleCardClick}
                onStatusChange={handleStatusChange}
                onSolicitarClientes={isLimitedUser ? solicitarClientes : undefined}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="lista" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-1.5 pb-6">
              <Card className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="text-primary" size={18} />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Lista de Leads</h3>
                      <p className="text-xs text-muted-foreground">
                        {filteredContatos.length} {filteredContatos.length === 1 ? 'lead' : 'leads'}
                      </p>
                    </div>
                  </div>
                </div>

                {(loading || loadingContatos) ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : filteredContatos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p>Nenhum lead encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          {[
                            { key: 'status', label: 'Status' },
                            { key: 'nome', label: 'Nome do Cliente' },
                            { key: 'departamento', label: 'Departamento' },
                            { key: 'vendedor', label: 'Vendedor' },
                            { key: 'produto', label: 'Produto de Interesse' },
                            { key: 'created_at', label: 'Data de Criação' },
                            { key: 'updated_at', label: 'Última Atualização' },
                          ].map((col) => (
                            <th 
                              key={col.key}
                              className="text-left py-2 px-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 transition-colors select-none"
                              onClick={() => {
                                if (listaSortColumn === col.key) {
                                  setListaSortDirection(listaSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setListaSortColumn(col.key);
                                  setListaSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-1">
                                {col.label}
                                {listaSortColumn === col.key ? (
                                  listaSortDirection === 'asc' ? (
                                    <ArrowUp className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5 text-primary" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredContatos]
                          .sort((a, b) => {
                            const direction = listaSortDirection === 'asc' ? 1 : -1;
                            
                            // Helper para buscar responsável
                            const getResponsavelProfile = (contato: Contato) => profiles.find(p => 
                              p.id === contato.responsavel_email || 
                              p.email === contato.responsavel_email || 
                              p.celular === contato.responsavel_email
                            );
                            
                            switch (listaSortColumn) {
                              case 'status':
                                return (a.status || '').localeCompare(b.status || '') * direction;
                              case 'nome':
                                return (a.nome || '').localeCompare(b.nome || '') * direction;
                              case 'departamento':
                                const deptA = getResponsavelProfile(a)?.departamento || '';
                                const deptB = getResponsavelProfile(b)?.departamento || '';
                                return deptA.localeCompare(deptB) * direction;
                              case 'vendedor':
                                const vendA = getResponsavelProfile(a)?.nome_completo || '';
                                const vendB = getResponsavelProfile(b)?.nome_completo || '';
                                return vendA.localeCompare(vendB) * direction;
                              case 'produto':
                                const prodA = a.observacoes?.includes('Produto:') 
                                  ? a.observacoes.split('Produto:')[1]?.split(',')[0]?.trim() || ''
                                  : '';
                                const prodB = b.observacoes?.includes('Produto:') 
                                  ? b.observacoes.split('Produto:')[1]?.split(',')[0]?.trim() || ''
                                  : '';
                                return prodA.localeCompare(prodB) * direction;
                              case 'created_at':
                                const createdA = new Date(a.created_at || 0).getTime();
                                const createdB = new Date(b.created_at || 0).getTime();
                                return (createdA - createdB) * direction;
                              case 'updated_at':
                              default:
                                const updatedA = new Date(a.updated_at || a.created_at || 0).getTime();
                                const updatedB = new Date(b.updated_at || b.created_at || 0).getTime();
                                return (updatedA - updatedB) * direction;
                            }
                          })
                          .map((contato) => {
                          // Buscar nome do responsável
                          const responsavelProfile = profiles.find(p => 
                            p.id === contato.responsavel_email || 
                            p.email === contato.responsavel_email || 
                            p.celular === contato.responsavel_email
                          );
                          
                          // Mapear status para label e cor do funil de vendas
                          const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
                            'Novo': { label: 'Novos', bgColor: '#FF8F6B', textColor: '#FFFFFF' },
                            'Atribuído': { label: 'Atribuídos', bgColor: '#FFC327', textColor: '#FFFFFF' },
                            'Em Espera': { label: 'Em Espera', bgColor: '#FFC327', textColor: '#FFFFFF' },
                            'Convidado': { label: 'Convidados', bgColor: '#2EC65C', textColor: '#FFFFFF' },
                            'Confirmado': { label: 'Confirmados', bgColor: '#5B93FF', textColor: '#FFFFFF' },
                            'Check-in': { label: 'Check-ins', bgColor: '#605BFF', textColor: '#FFFFFF' },
                            'Venda': { label: 'Vendas', bgColor: '#4830E4', textColor: '#FFFFFF' },
                            'Descartado': { label: 'Descartados', bgColor: '#A3A3A3', textColor: '#FFFFFF' },
                            'Opt Out': { label: 'Opt Out', bgColor: '#4B5563', textColor: '#FFFFFF' }
                          };
                          
                          const statusInfo = statusConfig[contato.status || ''] || { label: contato.status || '-', bgColor: '#9CA3AF', textColor: '#FFFFFF' };
                          
                          // Formatar data no formato DD/MM HH:MM
                          const formatDateTime = (dateStr: string | null | undefined) => {
                            if (!dateStr) return '-';
                            const date = new Date(dateStr);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const hours = date.getHours().toString().padStart(2, '0');
                            const minutes = date.getMinutes().toString().padStart(2, '0');
                            return `${day}/${month} ${hours}:${minutes}`;
                          };
                          
                          // Se não tem updated_at, usar created_at
                          const updatedAt = contato.updated_at || contato.created_at;
                          
                          return (
                            <tr 
                              key={contato.id} 
                              className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => {
                                setModalContato({
                                  isOpen: true,
                                  contato: contato,
                                  columnId: contato.status?.toLowerCase().replace(' ', '-')
                                });
                              }}
                            >
                              <td className="py-3 px-3">
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: statusInfo.bgColor, color: statusInfo.textColor }}
                                >
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-medium text-sm">{contato.nome}</span>
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {responsavelProfile?.departamento || '-'}
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {responsavelProfile?.nome_completo || '-'}
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {contato.observacoes?.includes('Produto:') 
                                  ? contato.observacoes.split('Produto:')[1]?.split(',')[0]?.trim() 
                                  : '-'}
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {formatDateTime(contato.created_at)}
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {formatDateTime(updatedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        <TabsContent value="recepcao" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-3 pb-6 px-1 sm:px-0">
              {/* Header com ações - Mobile First */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCheck className="text-primary" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Recepção</h3>
                    <p className="text-sm text-muted-foreground">
                      {totalVisitas} {totalVisitas === 1 ? 'visita' : 'visitas'}
                    </p>
                  </div>
                </div>
                
                {/* Botões de ação - empilhados no mobile */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button 
                    variant="outline"
                    onClick={() => setIsQRCodeScannerOpen(true)}
                    className="w-full sm:w-auto justify-center gap-2"
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>Ler QR Code</span>
                  </Button>
                  <Button 
                    onClick={() => {
                      setRecepcaoInitialData(null);
                      setIsRecepcaoModalOpen(true);
                    }}
                    className="w-full sm:w-auto justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Visita</span>
                  </Button>
                </div>
              </div>

              {/* Filtros de evento e status */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={recepcaoEventoFilter} onValueChange={setRecepcaoEventoFilter}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum evento selecionado</SelectItem>
                    <SelectItem value="todos">Todos os eventos</SelectItem>
                    {(recepcaoStatusFilter === "todos"
                      ? recepcaoProspeccoes
                      : recepcaoProspeccoes.filter(p => 
                          recepcaoStatusFilter === "ativos" ? p.ativo !== false : p.ativo === false
                        )
                    ).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={recepcaoStatusFilter} onValueChange={(v) => setRecepcaoStatusFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativos">Eventos Ativos</SelectItem>
                    <SelectItem value="inativos">Eventos Inativos</SelectItem>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conteúdo */}
              <Card className="p-3 sm:p-4">
                {recepcaoEventoFilter === "none" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Target className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">Selecione um evento</p>
                    <p className="text-sm text-muted-foreground mt-1">Use o filtro acima para visualizar as visitas</p>
                  </div>
                ) : loadingVisitas ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : (
                  <RecepcaoTable 
                    visitas={visitas} 
                    onDelete={async (visitaId) => {
                      await excluirVisita(visitaId);
                      await refetch();
                    }}
                    searchFilter=""
                  />
                )}

                {/* Paginação */}
                {recepcaoEventoFilter !== "none" && totalVisitas > recepcaoPageSize && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {Math.min((recepcaoPage - 1) * recepcaoPageSize + 1, totalVisitas)}-{Math.min(recepcaoPage * recepcaoPageSize, totalVisitas)} de {totalVisitas}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recepcaoPage <= 1}
                        onClick={() => setRecepcaoPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Página {recepcaoPage} de {Math.ceil(totalVisitas / recepcaoPageSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recepcaoPage >= Math.ceil(totalVisitas / recepcaoPageSize)}
                        onClick={() => setRecepcaoPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        <TabsContent value="vendas" className="flex-1 min-h-0 overflow-hidden w-full">
          <VendasProspeccaoTab globalFilters={globalFilters} />
        </TabsContent>
      </Tabs>

      <CriarProspeccaoModal
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingProspeccao(null);
          }
        }}
        editingProspeccao={editingProspeccao}
        onProspeccaoCriada={refetch}
      />


      <ContatoModal
        isOpen={modalContato.isOpen}
        onClose={handleCloseModal}
        contato={modalContato.contato}
        columnId={modalContato.columnId}
        prospeccaoId={prospeccoes[0]?.id}
        onStatusChange={handleModalStatusChange}
        onDelete={handleModalDelete}
        onAssignResponsible={handleModalAssignResponsible}
        onCreateContact={(novoContato) => {
          adicionarContatos([{
            ...novoContato,
            origem: 'Outros' as const,
            observacoes: 'Adicionado via Kanban'
          }]);
        }}
        requireProdutoVendido={modalContato.requireProdutoVendido}
        onConfirmVenda={handleConfirmVenda}
      />

      <RecepcaoModal
        isOpen={isRecepcaoModalOpen}
        onClose={() => {
          setIsRecepcaoModalOpen(false);
          setRecepcaoInitialData(null);
        }}
        onSearch={handleRecepcaoSearch}
        prospeccoes={prospeccoes}
      />

      <HistoricoImportacaoModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        historico={historicoImportacao}
      />

      <ClientesPorUsuarioModal
        isOpen={isClientesPorUsuarioModalOpen}
        onClose={() => setIsClientesPorUsuarioModalOpen(false)}
        usuarios={getClientesPorUsuario()}
      />

      <NovoLeadModal
        isOpen={isNovoLeadModalOpen}
        onClose={() => setIsNovoLeadModalOpen(false)}
        onLeadCreated={refetch}
        onOpenContato={handleOpenContatoFromFab}
        profiles={profiles}
      />

      <DescarteLeadModal
        isOpen={descarteModal.isOpen}
        onClose={() => setDescarteModal({ isOpen: false, contatoId: '', contatoNome: '', fromStatus: '' })}
        contatoId={descarteModal.contatoId}
        contatoNome={descarteModal.contatoNome}
        onConfirm={async (motivoId, justificativa) => {
          try {
            // Atualizar status do contato para Descartado
            await atualizarStatusContato(descarteModal.contatoId, 'Descartado');
            
            // Registrar movimentação com motivo e justificativa
            if (registrarMovimentacao && user && prospeccoes?.length > 0) {
              const motivoDescricao = await supabase
                .from('motivos_insucesso')
                .select('descricao')
                .eq('id', motivoId)
                .single();
              
              await registrarMovimentacao({
                leadId: descarteModal.contatoId,
                prospeccaoId: prospeccoes[0].id,
                statusAnterior: descarteModal.fromStatus,
                statusNovo: 'descartados',
                usuarioId: user.id,
                observacoes: `Motivo: ${motivoDescricao.data?.descricao || 'N/A'} | Justificativa: ${justificativa}`
              });
            }
            
            toast({
              title: "Lead Descartado",
              description: "O lead foi movido para Descartados com sucesso.",
            });
            
            setDescarteModal({ isOpen: false, contatoId: '', contatoNome: '', fromStatus: '' });
            refetch();
          } catch (error) {
            console.error('Erro ao descartar lead:', error);
            toast({
              title: "Erro",
              description: "Não foi possível descartar o lead. Tente novamente.",
              variant: "destructive"
            });
          }
        }}
      />

      <QRCodeScanner
        isOpen={isQRCodeScannerOpen}
        onClose={() => setIsQRCodeScannerOpen(false)}
        onScanComplete={handleQRScanComplete}
        validarEvento={validarEvento}
        buscarContato={buscarContatoPorTelefoneEvento}
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

      <FloatingActionButton
        onNovoLead={handleNovoLead}
        onNovoCheckin={handleNovoCheckin}
        onNovaVenda={handleNovaVenda}
      />

      {/* Modal de Base do Evento */}
      <EventoBaseModal
        isOpen={eventoBaseModal.isOpen}
        onClose={() => setEventoBaseModal({ isOpen: false, prospeccao: null })}
        prospeccao={eventoBaseModal.prospeccao}
        onDispararParaIA={async (prospeccaoId, canal) => {
          await handleDispararParaIA(prospeccaoId, canal);
          // Recarregar contagem após disparo
          const contagem = await contarContatosPendentesDisparo(prospeccaoId);
          setContagemPendentes(prev => ({ ...prev, [prospeccaoId]: contagem }));
        }}
        isDisparandoIA={disparandoIA === eventoBaseModal.prospeccao?.id}
      />

      {/* Modal de Confirmação de Exclusão de Evento */}
      <AlertDialog open={deleteEventoModal.isOpen} onOpenChange={(open) => !open && setDeleteEventoModal({ isOpen: false, prospeccao: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o evento <strong>"{deleteEventoModal.prospeccao?.titulo}"</strong>?
              <br /><br />
              Esta ação é irreversível e todos os dados associados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingEvento}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProspeccao}
              disabled={deletingEvento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingEvento ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Evento
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Simulação de Custos */}
      <DispararCustoModal
        isOpen={custoModal.isOpen}
        onClose={() => setCustoModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executarDisparo}
        prospeccaoId={custoModal.prospeccaoId}
        eventoNome={custoModal.eventoNome}
        canal={custoModal.canal}
        totalContatos={custoModal.totalContatos}
      />
    </DashboardLayout>
  );
};

export default Prospeccao;
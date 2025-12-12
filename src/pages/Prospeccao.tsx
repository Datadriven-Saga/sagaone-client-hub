import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Target, CheckCircle, Edit, Trash2, MoreVertical, UserCheck, Plus } from "lucide-react";
import { ProspeccaoGlobalFilter, ProspeccaoGlobalFilters } from "@/components/ProspeccaoGlobalFilter";
import { UploadPlanilha } from "@/components/UploadPlanilha";
import { BaseExistente } from "@/components/BaseExistente";
import { CriarProspeccaoModal } from "@/components/CriarProspeccaoModal";
import { ContatoModal } from "@/components/ContatoModal";
import { RecepcaoModal } from "@/components/RecepcaoModal";
import { RecepcaoTable } from "@/components/RecepcaoTable";
import { ProspeccaoVisaoGeral } from "@/components/ProspeccaoVisaoGeral";
import { HistoricoImportacaoModal } from "@/components/HistoricoImportacaoModal";
import { ClientesPorUsuarioModal } from "@/components/ClientesPorUsuarioModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { NovoLeadModal } from "@/components/NovoLeadModal";
import { VendasProspeccaoTab } from "@/components/VendasProspeccaoTab";
import { useVendasProspeccao } from "@/hooks/useVendasProspeccao";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useProspeccaoLogs } from "@/hooks/useProspeccaoLogs";
import { useContatoData, kanbanStatusMap, Contato } from "@/hooks/useContatoData";
import { useRecepcaoData } from "@/hooks/useRecepcaoData";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
}

interface ProspeccaoProps {
  defaultTab?: 'eventos' | 'atendimento';
}

const Prospeccao = ({ defaultTab }: ProspeccaoProps) => {
  console.log('🚀 Prospeccao component initiated');
  
  // ✅ TODOS OS HOOKS DEVEM VIR PRIMEIRO - ANTES DE QUALQUER LÓGICA
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProspeccao, setEditingProspeccao] = useState<any>(null);
  const [deleteProspeccaoId, setDeleteProspeccaoId] = useState<string | null>(null);
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
    if (defaultTab === 'eventos') return 'visao-geral';
    if (defaultTab === 'atendimento') return 'kanban';
    const savedTab = sessionStorage.getItem('prospeccao_active_tab');
    return savedTab || 'visao-geral';
  });
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [recepcaoInitialData, setRecepcaoInitialData] = useState<any>(null);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [isClientesPorUsuarioModalOpen, setIsClientesPorUsuarioModalOpen] = useState(false);
  const [isNovoLeadModalOpen, setIsNovoLeadModalOpen] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[]>([]);
  
  // Filtro global unificado para todas as abas
  const [globalFilters, setGlobalFilters] = useState<ProspeccaoGlobalFilters>({
    prospeccaoId: "todos",
    dataInicio: "",
    dataFim: "",
    responsavelId: "todos",
    status: "todos",
    dadosLead: ""
  });
  
  // ✅ HOOKS DE CONTEXTO E CUSTOM HOOKS
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany, loading: companyLoading, switchCompany } = useCompany();
  const { registrarMovimentacao } = useProspeccaoLogs();
  const { 
    contatos, 
    prospeccoes, 
    loading, 
    adicionarContatos,
    atualizarStatusContato,
    excluirContato,
    atribuirResponsavel,
    getMetricas, 
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    refetch
  } = useContatoData();
  
  const { vendas, criarVenda, refetch: refetchVendas } = useVendasProspeccao();
  
  const { 
    visitas, 
    loading: loadingVisitas, 
    adicionarVisita, 
    excluirVisita 
  } = useRecepcaoData();
  
  console.log('🔑 User from auth:', user);
  console.log('📊 Data from hooks - contatos:', contatos?.length, 'prospeccoes:', prospeccoes?.length, 'loading:', loading);

  // Buscar profiles com email e celular para mapear responsavel_email
  useEffect(() => {
    const fetchProfiles = async () => {
      // Buscar profiles com celular
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
        
        // Buscar emails dos usuários via edge function
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

  // Persistir aba ativa
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

  // Calcular métricas dos contatos (antes do early return para uso nos useMemo)
  const metricas = getMetricas();

  // ✅ TODOS OS USEMEMO DEVEM VIR ANTES DO EARLY RETURN
  // Função de filtragem global para contatos
  const filteredContatos = useMemo(() => {
    return contatos.filter(contato => {
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
      // Filtro unificado: Dados do Lead (nome, telefone, email, id, produto)
      if (globalFilters.dadosLead) {
        const search = globalFilters.dadosLead.toLowerCase().trim();
        if (search) {
          const matchNome = contato.nome?.toLowerCase().includes(search);
          const matchTelefone = contato.telefone?.replace(/\D/g, '').includes(search.replace(/\D/g, ''));
          const matchEmail = contato.email?.toLowerCase().includes(search);
          const matchId = contato.id?.toLowerCase().includes(search);
          if (!matchNome && !matchTelefone && !matchEmail && !matchId) return false;
        }
      }
      return true;
    });
  }, [contatos, globalFilters, profiles]);

  // Função de filtragem global para prospecções/eventos
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

  // Função de filtragem global para visitas (recepção)
  const filteredVisitas = useMemo(() => {
    return visitas.filter(visita => {
      if (globalFilters.dataInicio) {
        const dataInicio = new Date(globalFilters.dataInicio);
        const visitaData = new Date(visita.data_hora_visita);
        if (visitaData < dataInicio) return false;
      }
      if (globalFilters.dataFim) {
        const dataFim = new Date(globalFilters.dataFim);
        dataFim.setHours(23, 59, 59, 999);
        const visitaData = new Date(visita.data_hora_visita);
        if (visitaData > dataFim) return false;
      }
      // Filtro unificado: Dados do Lead (nome, telefone)
      if (globalFilters.dadosLead) {
        const search = globalFilters.dadosLead.toLowerCase();
        const matchNome = visita.nome_cliente?.toLowerCase().includes(search);
        const matchTelefone = visita.telefone_cliente?.replace(/\D/g, '').includes(search.replace(/\D/g, ''));
        if (!matchNome && !matchTelefone) return false;
      }
      return true;
    });
  }, [visitas, globalFilters]);

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

  // Função para importar clientes como contatos
  const handleClientesImported = async (campanha: string, clientes: ClienteData[]) => {
    try {
      console.log('=== INICIANDO IMPORTAÇÃO ===');
      console.log('Campanha:', campanha);
      console.log('Quantidade de clientes:', clientes.length);
      console.log('Usuário logado:', user?.id);
      
      // Buscar o ID da prospecção pela campanha selecionada
      const prospeccaoSelecionada = prospeccoes.find(p => p.titulo === campanha);
      console.log('Prospecção selecionada:', prospeccaoSelecionada);
      
      if (!prospeccaoSelecionada) {
        throw new Error(`Prospecção "${campanha}" não encontrada`);
      }
      
      // Processar cada cliente usando o hook useContatoData
      const novosContatos = clientes.map(cliente => ({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email || undefined,
        origem: 'Outros' as const,
        observacoes: `Importado da campanha: ${campanha}`,
        responsavel_email: cliente.responsavel && cliente.responsavel.trim() ? cliente.responsavel : undefined
      }));

      console.log('=== PROCESSANDO CLIENTES ===');
      console.log('Novos contatos a serem adicionados:', novosContatos);
      console.log('Prospeccao selecionada ID:', prospeccaoSelecionada.id);

      // Usar a função do hook que já trata empresa_id automaticamente e dispara webhooks
      await adicionarContatos(novosContatos, prospeccaoSelecionada.id);

      toast({
        title: "Planilha importada",
        description: `${clientes.length} contatos foram importados e adicionados ao Kanban`,
      });
      
      // Forçar atualização dos dados
      refetch();
      
    } catch (error) {
      console.error('Erro ao importar contatos:', error);
      toast({
        title: "Erro na importação",
        description: `Erro: ${error.message || 'Não foi possível importar os contatos'}`,
        variant: "destructive"
      });
    }
  };

  const handleClientesSelected = async (campanha: string, clientes: ClienteData[]) => {
    try {
      // Buscar o ID da prospecção pela campanha selecionada
      const prospeccaoSelecionada = prospeccoes.find(p => p.titulo === campanha);
      
      const novosContatos = clientes.map(cliente => ({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        origem: 'Outros' as const,
        observacoes: `Selecionado da base: ${campanha}`
      }));

      await adicionarContatos(novosContatos, prospeccaoSelecionada?.id);

      toast({
        title: "Clientes adicionados",
        description: `${clientes.length} clientes da base foram adicionados ao Kanban`,
      });
    } catch (error) {
      console.error('Erro ao adicionar contatos:', error);
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
    await excluirContato(contatoId);
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
      // Verificar se o usuário tem contatos na coluna "Atribuídos"
      const contatosAtribuidos = contatos.filter(
        contato => contato && contato.status === 'Negociação' && contato.responsavel_email === user.email
      );

      if (contatosAtribuidos.length > 0) {
        toast({
          title: "Não é possível solicitar clientes",
          description: "Você possui clientes parados na coluna Atribuídos. Finalize o atendimento antes de solicitar novos clientes.",
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

      // Atribuir até 5 clientes para o usuário
      const clientesParaAtribuir = contatosNovos.slice(0, 5);
      
      for (const contato of clientesParaAtribuir) {
        await atribuirResponsavel(contato.id, user.email!);
        // Mover para coluna "Atribuídos" (status 'Negociação')
        await atualizarStatusContato(contato.id, 'Negociação');
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

  const handleDeleteProspeccao = async (prospeccaoId: string) => {
    try {
      if (excluirProspeccao) {
        await excluirProspeccao(prospeccaoId);
        setDeleteProspeccaoId(null);
        toast({
          title: "Prospecção excluída",
          description: "A prospecção foi removida com sucesso."
        });
      }
    } catch (error) {
      console.error('Erro ao excluir prospecção:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a prospecção.",
        variant: "destructive"
      });
    }
  };


  return (
    <DashboardLayout title="Prospecção">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full w-full">
        <TabsList className="inline-flex self-start">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="automacao">Adicionar Contatos</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="recepcao">Recepção</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        {/* Filtro Global Unificado */}
        <ProspeccaoGlobalFilter
          prospeccoes={prospeccoes.map(p => ({ id: p.id, titulo: p.titulo }))}
          responsaveis={profiles.map(p => ({ id: p.id, nome_completo: p.nome_completo, tipo_acesso: p.tipo_acesso }))}
          filters={globalFilters}
          onFiltersChange={setGlobalFilters}
        />

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
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-foreground">Lista de Eventos</h3>
                    <span className="text-sm text-muted-foreground">
                      {filteredProspeccoes.length} {filteredProspeccoes.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </div>
                  <Button onClick={() => setIsModalOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Prospecção
                  </Button>
                </div>
                
                {prospeccoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p>Nenhum evento cadastrado</p>
                    <p className="text-sm">Clique em "Nova Prospecção" para criar um evento</p>
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
                            const hoje = new Date();
                            const dataInicio = prospeccao.data_inicio ? new Date(prospeccao.data_inicio) : null;
                            const dataFim = prospeccao.data_fim ? new Date(prospeccao.data_fim) : null;
                            
                            let status = 'Ativo';
                            let statusColor = 'bg-green-100 text-green-700';
                            
                            if (dataFim && hoje > dataFim) {
                              status = 'Encerrado';
                              statusColor = 'bg-gray-100 text-gray-700';
                            } else if (dataInicio && hoje < dataInicio) {
                              status = 'Agendado';
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
                                {prospeccao.data_inicio ? new Date(prospeccao.data_inicio).toLocaleDateString('pt-BR') : '-'}
                              </td>
                              <td className="py-3 px-3 text-sm text-muted-foreground">
                                {prospeccao.data_fim ? new Date(prospeccao.data_fim).toLocaleDateString('pt-BR') : '-'}
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
                              <td className="py-3 px-3 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditProspeccao(prospeccao)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => setDeleteProspeccaoId(prospeccao.id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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

        <TabsContent value="automacao" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-3 pb-6">
              <Card className="p-4">
                <h3 className="text-base font-semibold text-foreground mb-3">Adicionar Contatos à Prospecção</h3>
                
                {/* Contador de Contatos */}
                {contatos.length > 0 && (
                  <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="text-green-600" size={18} />
                      <div>
                        <p className="font-medium text-green-800 text-sm">
                          {contatos.length} contatos cadastrados no sistema
                        </p>
                        <p className="text-xs text-green-600">
                          Todos os contatos estão disponíveis no Kanban para gestão
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
                        onClientesImported={handleClientesImported}
                        prospeccoes={prospeccoes}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Configuração de Automação</h4>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Disparar via Meta Ads</p>
                          <p className="text-xs text-muted-foreground">
                            Configurar integração com gerenciador de anúncios
                          </p>
                        </div>
                        <Button size="sm">Configurar</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        <TabsContent value="kanban" className="mt-0 w-full">
          <div className="h-[calc(100vh-220px)] w-full overflow-hidden">
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={() => {}}
              onCardClick={handleCardClick}
              onStatusChange={handleStatusChange}
              onSolicitarClientes={solicitarClientes}
            />
          </div>
        </TabsContent>

        <TabsContent value="recepcao" className="flex-1 min-h-0 overflow-hidden w-full">
          <ScrollIndicator className="flex-1 h-full">
            <div className="space-y-1.5 pb-6">
              <Card className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="text-primary" size={18} />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Recepção de Visitas</h3>
                      <p className="text-xs text-muted-foreground">
                        {filteredVisitas.length} {filteredVisitas.length === 1 ? 'visita registrada' : 'visitas registradas'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setRecepcaoInitialData(null);
                      setIsRecepcaoModalOpen(true);
                    }}
                  >
                    Registrar Visita
                  </Button>
                </div>

                {loadingVisitas ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <RecepcaoTable 
                    visitas={filteredVisitas} 
                    onDelete={async (visitaId) => {
                      await excluirVisita(visitaId);
                      await refetch();
                    }}
                    searchFilter=""
                  />
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

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={deleteProspeccaoId !== null} onOpenChange={() => setDeleteProspeccaoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Prospecção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta prospecção? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProspeccaoId && handleDeleteProspeccao(deleteProspeccaoId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        onSave={adicionarVisita}
        initialData={recepcaoInitialData}
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

      <FloatingActionButton
        onNovoLead={handleNovoLead}
        onNovoCheckin={handleNovoCheckin}
        onNovaVenda={handleNovaVenda}
      />
    </DashboardLayout>
  );
};

export default Prospeccao;
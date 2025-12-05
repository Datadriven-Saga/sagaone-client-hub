import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, CheckCircle, Edit, Trash2, MoreVertical, UserCheck, Plus } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { UploadPlanilha } from "@/components/UploadPlanilha";
import { BaseExistente } from "@/components/BaseExistente";
import { CriarProspeccaoModal } from "@/components/CriarProspeccaoModal";
import { ContatoModal } from "@/components/ContatoModal";
import { RecepcaoModal } from "@/components/RecepcaoModal";
import { RecepcaoTable } from "@/components/RecepcaoTable";
import { ProspeccaoVisaoGeral } from "@/components/ProspeccaoVisaoGeral";
import { HistoricoImportacaoModal } from "@/components/HistoricoImportacaoModal";
import { ClientesPorUsuarioModal } from "@/components/ClientesPorUsuarioModal";
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

const Prospeccao = () => {
  console.log('🚀 Prospeccao component initiated');
  
  // ✅ TODOS OS HOOKS DEVEM VIR PRIMEIRO - ANTES DE QUALQUER LÓGICA
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [editingProspeccao, setEditingProspeccao] = useState<any>(null);
  const [deleteProspeccaoId, setDeleteProspeccaoId] = useState<string | null>(null);
  const [modalContato, setModalContato] = useState<{ isOpen: boolean; contato: Contato | null; columnId?: string }>({
    isOpen: false,
    contato: null,
    columnId: undefined
  });
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('prospeccao_active_tab');
    return savedTab || 'visao-geral';
  });
  const [isRecepcaoModalOpen, setIsRecepcaoModalOpen] = useState(false);
  const [recepcaoInitialData, setRecepcaoInitialData] = useState<any>(null);
  const [recepcaoSearchFilter, setRecepcaoSearchFilter] = useState('');
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [isClientesPorUsuarioModalOpen, setIsClientesPorUsuarioModalOpen] = useState(false);
  
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
  
  const { 
    visitas, 
    loading: loadingVisitas, 
    adicionarVisita, 
    excluirVisita 
  } = useRecepcaoData();
  
  console.log('🔑 User from auth:', user);
  console.log('📊 Data from hooks - contatos:', contatos?.length, 'prospeccoes:', prospeccoes?.length, 'loading:', loading);

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
  const handleStatusChange = async (itemId: string, fromStatus: string, toStatus: string) => {
    const novoStatusDb = kanbanStatusMap[toStatus as keyof typeof kanbanStatusMap];
    if (novoStatusDb) {
      await atualizarStatusContato(itemId, novoStatusDb);
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
  };

  // ✅ AGORA EARLY RETURN PODE VIR APÓS TODOS OS HOOKS
  console.log('⏳ Loading status check:', loading);
  
  if (loading) {
    console.log('🔄 Rendering loading state...');
    return (
      <DashboardLayout title="Prospecção">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  console.log('✅ All data loaded, rendering main component...');
  
  // Calcular métricas dos contatos após verificar loading
  console.log('📈 Calculating metricas...');
  const metricas = getMetricas();
  console.log('📊 Metricas calculated:', metricas);
  
  // Dados para o novo layout da Visão Geral
  const visaoGeralMetrics = {
    ativosNaProspeccao: metricas.totalBase,
    disponiveisDistribuicao: metricas.disponiveisDistribuicao,
    emEspera: metricas.emEspera,
    descartados: metricas.descartados,
    paraExclusao: metricas.optOut
  };

  const funnelDataNew = {
    distribuidosSemAcao: metricas.atribuidos,
    contatados: metricas.convidados,
    semContato: metricas.emEspera,
    convidados: metricas.convidados,
    confirmados: metricas.confirmados,
    checkIns: metricas.checkin
  };

  // Dados mock para histórico (implementar busca real depois)
  const historicoImportacao: any[] = [];
  
  // Dados de clientes por usuário (implementar busca real depois)
  const getClientesPorUsuario = () => {
    const usuariosMap = new Map<string, { novos: number; atribuidos: number; emEspera: number; convidados: number }>();
    
    contatos.forEach(contato => {
      const responsavel = contato.responsavel_email || 'Não atribuído';
      const current = usuariosMap.get(responsavel) || { novos: 0, atribuidos: 0, emEspera: 0, convidados: 0 };
      
      if (contato.status === 'Novo') current.novos++;
      if (contato.status === 'Atribuído') current.atribuidos++;
      if (contato.status === 'Em Espera') current.emEspera++;
      if (contato.status === 'Convidado') current.convidados++;
      
      usuariosMap.set(responsavel, current);
    });

    return Array.from(usuariosMap.entries()).map(([email, counts]) => ({
      id: email,
      nome: email.split('@')[0] || email,
      email: email,
      totalClientes: counts.novos + counts.atribuidos + counts.emEspera + counts.convidados,
      ...counts
    }));
  };

  // Converter contatos para itens do Kanban
  const contatosToKanbanItems = (contatosLista: typeof contatos): KanbanItem[] => {
    if (!contatosLista || !Array.isArray(contatosLista)) return [];
    
    return contatosLista
      .filter(contato => contato && contato.nome)
      .filter(contato => {
        if (!searchFilter) return true;
        const searchLower = searchFilter.toLowerCase();
        return (
          contato.nome?.toLowerCase().includes(searchLower) ||
          contato.telefone?.includes(searchLower) ||
          contato.email?.toLowerCase().includes(searchLower) ||
          contato.origem?.toLowerCase().includes(searchLower)
        );
      })
      .map(contato => {
        const prospeccaoNome = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].titulo : 'Sem prospecção';
        const prospeccaoCanal = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].canal : 'Whatsapp';
        
        return {
          id: contato.id || '',
          title: contato.nome || 'Sem nome',
          description: contato.observacoes || undefined,
          channel: contato.telefone || '',
          tags: contato.origem ? [contato.origem] : undefined,
          dueDate: contato.created_at || undefined,
          assignee: contato.responsavel_email || undefined,
          prospeccaoNome,
          prospeccaoCanal,
          segmentacao: 'Undefined'
        };
      });
  };

  // Configurar colunas do Kanban com dados reais - com verificações de segurança
  const kanbanColumns: KanbanColumnData[] = [
    {
      id: 'novos',
      title: 'Novos',
      color: '#6645EB',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Novo')) : []
    },
    {
      id: 'atribuidos',
      title: 'Atribuídos',
      color: '#8B5FD6',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Atribuído')) : []
    },
    {
      id: 'emespera',
      title: 'Em Espera',
      color: '#F59E0B',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Em Espera')) : []
    },
    {
      id: 'convidados',
      title: 'Convidados',
      color: '#A679E1',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Convidado')) : []
    },
    {
      id: 'agendados',
      title: 'Agendados',
      color: '#C193EC',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Agendado')) : []
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Confirmado')) : []
    },
    {
      id: 'checkin',
      title: 'Check-in',
      color: '#22c55e',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Check-in')) : []
    },
    {
      id: 'descartados',
      title: 'Descartados',
      color: '#ef4444',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Descartado')) : []
    },
    {
      id: 'optout',
      title: 'Opt Out',
      color: '#6B7280',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Opt Out')) : []
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
    setModalContato({ isOpen: false, contato: null, columnId: undefined });
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0.5">
        <TabsList className="inline-flex">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="automacao">Adicionar Contatos</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="recepcao">Recepção</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div />
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Prospecção
            </Button>
          </div>

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
        </TabsContent>

        <TabsContent value="automacao" className="space-y-3">
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
        </TabsContent>

        <TabsContent value="kanban" className="mt-0">
          <div className="mb-1">
            <FilterBar
              searchPlaceholder="Buscar por cliente, campanha ou status..."
              onSearchChange={setSearchFilter}
            />
          </div>
          
          <div className="h-[calc(100vh-220px)] overflow-auto">
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={() => {}}
              onCardClick={handleCardClick}
              onStatusChange={handleStatusChange}
              onSolicitarClientes={solicitarClientes}
            />
          </div>
        </TabsContent>

        <TabsContent value="recepcao" className="space-y-1.5">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="text-primary" size={18} />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Recepção de Visitas</h3>
                  <p className="text-xs text-muted-foreground">
                    {visitas.length} {visitas.length === 1 ? 'visita registrada' : 'visitas registradas'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FilterBar
                  searchPlaceholder="Buscar..."
                  onSearchChange={setRecepcaoSearchFilter}
                  className="w-64"
                  compact
                />
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
            </div>

            {loadingVisitas ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <RecepcaoTable 
                visitas={visitas} 
                onDelete={async (visitaId) => {
                  await excluirVisita(visitaId);
                  await refetch();
                }}
                searchFilter={recepcaoSearchFilter}
              />
            )}
          </Card>
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
    </DashboardLayout>
  );
};

export default Prospeccao;
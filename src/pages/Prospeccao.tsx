import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { SalesFunnel, FunnelStage } from "@/components/SalesFunnel";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, CheckCircle, Edit, Trash2, MoreVertical } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { UploadPlanilha } from "@/components/UploadPlanilha";
import { BaseExistente } from "@/components/BaseExistente";
import { CriarProspeccaoModal } from "@/components/CriarProspeccaoModal";
import { ContatoModal } from "@/components/ContatoModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProspeccaoLogs } from "@/hooks/useProspeccaoLogs";
import { useContatoData, kanbanStatusMap, Contato } from "@/hooks/useContatoData";
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
  
  // ✅ HOOKS DE CONTEXTO E CUSTOM HOOKS
  const { toast } = useToast();
  const { user } = useAuth();
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
  
  console.log('🔑 User from auth:', user);
  console.log('📊 Data from hooks - contatos:', contatos?.length, 'prospeccoes:', prospeccoes?.length, 'loading:', loading);

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
  const funnelData: FunnelStage[] = [
    {
      id: 'total-base',
      title: 'Total da Base',
      value: metricas.totalBase,
      color: '#1f2937'
    },
    {
      id: 'atribuidos',
      title: 'Atribuídos',
      value: metricas.atribuidos,
      color: '#8B5FD6'
    },
    {
      id: 'convidados',
      title: 'Convidados',
      value: metricas.convidados,
      color: '#A679E1'
    },
    {
      id: 'agendados',
      title: 'Agendados',
      value: metricas.agendados,
      color: '#C193EC'
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      value: metricas.confirmados,
      color: '#10b981'
    },
    {
      id: 'check-in',
      title: 'Check-in',
      value: metricas.checkin,
      color: '#22c55e'
    },
    {
      id: 'descartados',
      title: 'Descartados',
      value: metricas.descartados,
      color: '#ef4444'
    }
  ];

  // Converter contatos para itens do Kanban
  const contatosToKanbanItems = (contatosLista: typeof contatos): KanbanItem[] => {
    if (!contatosLista || !Array.isArray(contatosLista)) return [];
    
    return contatosLista
      .filter(contato => contato && contato.nome) // Filtrar contatos nulos ou sem nome
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
        // Valores padrão seguros
        const prospeccaoNome = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].titulo : 'Sem prospecção';
        const prospeccaoCanal = (prospeccoes && prospeccoes.length > 0) ? prospeccoes[0].canal : 'Whatsapp';
        
        return {
          id: contato.id || '',
          title: contato.nome || 'Sem nome',
          description: `${contato.telefone || ''}${contato.email ? ` - ${contato.email}` : ''}`,
          channel: contato.origem || 'Outros',
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
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Negociação')) : []
    },
    {
      id: 'convidados',
      title: 'Convidados',
      color: '#A679E1',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Em Contato')) : []
    },
    {
      id: 'agendados',
      title: 'Agendados',
      color: '#C193EC',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Qualificado')) : []
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Fechado')) : []
    },
    {
      id: 'checkin',
      title: 'Check-in',
      color: '#22c55e',
      items: contatos ? contatosToKanbanItems(contatos.filter(contato => contato && contato.status === 'Perdido')) : []
    },
    {
      id: 'descartados',
      title: 'Descartados',
      color: '#ef4444',
      items: []
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
      <Tabs defaultValue="visao-geral" className="space-y-3">
        <TabsList className="inline-flex">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="automacao">Adicionar Contatos</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-3">
          <FilterBar
            searchPlaceholder="Filtrar prospecções por nome, marca ou status..."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil de Vendas */}
            <div className="order-2 lg:order-1">
              <SalesFunnel 
                stages={funnelData}
                title="Funil de Vendas Geral"
              />
            </div>

            {/* Lista de Prospecções */}
            <div className="order-1 lg:order-2 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Prospecções</h3>
                  <Button onClick={() => setIsModalOpen(true)}>Nova Prospecção</Button>
                </div>

                {prospeccoes.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-muted">
                      <Checkbox 
                        id="select-all"
                        checked={selectedProspections.length === prospeccoes.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <label 
                        htmlFor="select-all" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Selecionar todas ({prospeccoes.length})
                      </label>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {prospeccoes.map((item) => (
                        <Card 
                          key={item.id} 
                          className={`cursor-pointer hover:shadow-card transition-shadow p-4 ${
                            item.canal === 'Whatsapp' 
                              ? 'border-t-4 border-t-green-500' 
                              : 'border-t-4 border-t-blue-500'
                          }`}
                          onClick={() => handleEditProspeccao(item)}
                        >
                          <div className="flex items-start space-x-3">
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                id={`prospect-${item.id}`}
                                checked={selectedProspections.includes(item.id)}
                                onCheckedChange={(checked) => handleProspectionSelection(item.id, !!checked)}
                              />
                            </div>
                            
                             <div className="flex-1">
                               <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                   <h4 className="font-semibold">{item.titulo}</h4>
                                   <span className={`px-2 py-1 text-xs rounded-full ${
                                     item.canal === 'Whatsapp'
                                       ? 'bg-green-100 text-green-700'
                                       : 'bg-blue-100 text-blue-700'
                                   }`}>
                                     {item.canal}
                                   </span>
                                 </div>
                                 
                                 {/* Menu de ações */}
                                 <div onClick={(e) => e.stopPropagation()}>
                                   <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                       <Button 
                                         variant="ghost" 
                                         size="sm"
                                         className="h-8 w-8 p-0"
                                       >
                                         <MoreVertical size={16} />
                                       </Button>
                                     </DropdownMenuTrigger>
                                     <DropdownMenuContent align="end">
                                       <DropdownMenuItem onClick={() => handleEditProspeccao(item)}>
                                         <Edit size={16} className="mr-2" />
                                         Editar
                                       </DropdownMenuItem>
                                       <DropdownMenuItem 
                                         onClick={() => setDeleteProspeccaoId(item.id)}
                                         className="text-red-600"
                                       >
                                         <Trash2 size={16} className="mr-2" />
                                         Excluir
                                       </DropdownMenuItem>
                                     </DropdownMenuContent>
                                   </DropdownMenu>
                                 </div>
                               </div>
                              <p className="text-sm text-muted-foreground">
                                {item.data_inicio && item.data_fim 
                                  ? `${item.data_inicio} - ${item.data_fim}` 
                                  : 'Datas não definidas'
                                }
                              </p>
                              <p className="text-sm">Meta: {item.meta_leads || 0} contatos</p>
                              <p className="text-sm">Gerados: {item.leads_gerados}</p>
                              {item.descricao && (
                                <p className="text-xs text-muted-foreground mt-1">{item.descricao}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="mx-auto mb-2" size={32} />
                    <p>Nenhuma prospecção encontrada</p>
                    <p className="text-sm">Crie sua primeira prospecção para começar</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automacao" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Adicionar Contatos à Prospecção</h3>
            
            {/* Contador de Contatos */}
            {contatos.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <div>
                    <p className="font-medium text-green-800">
                      {contatos.length} contatos cadastrados no sistema
                    </p>
                    <p className="text-sm text-green-600">
                      Todos os contatos estão disponíveis no Kanban para gestão
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Carga de Clientes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <h4 className="font-semibold mb-3">Configuração de Automação</h4>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Disparar via Meta Ads</p>
                      <p className="text-sm text-muted-foreground">
                        Configurar integração com gerenciador de anúncios
                      </p>
                    </div>
                    <Button>Configurar</Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
          <div className="flex-shrink-0 space-y-3">
            <FilterBar
              searchPlaceholder="Buscar por cliente, campanha ou status..."
              onSearchChange={setSearchFilter}
            />
            
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Kanban - Gestão da Prospecção</h3>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground">
                    Total de contatos: {contatos.length}
                  </div>
                  <Button
                    onClick={solicitarClientes}
                    variant="outline"
                    size="sm"
                  >
                    Solicitar Clientes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={() => {}} // Será atualizado automaticamente pelos dados do banco
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onCardClick={handleCardClick}
              onStatusChange={handleStatusChange}
            />
          </div>
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
    </DashboardLayout>
  );
};

export default Prospeccao;
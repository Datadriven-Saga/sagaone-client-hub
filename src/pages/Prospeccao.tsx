import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { SalesFunnel, FunnelStage } from "@/components/SalesFunnel";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, CheckCircle } from "lucide-react";
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

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
}

const Prospeccao = () => {
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
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
    refetch 
  } = useContatoData();

  // Função para registrar movimentações dos contatos
  const handleStatusChange = async (itemId: string, fromStatus: string, toStatus: string) => {
    const novoStatusDb = kanbanStatusMap[toStatus as keyof typeof kanbanStatusMap];
    if (novoStatusDb) {
      await atualizarStatusContato(itemId, novoStatusDb);
    }

    if (registrarMovimentacao && user) {
      await registrarMovimentacao({
        leadId: itemId,
        prospeccaoId: prospeccoes[0]?.id || 'default', 
        statusAnterior: fromStatus,
        statusNovo: toStatus,
        usuarioId: user.id,
      });
    }
  };

  // Calcular métricas dos contatos
  const metricas = getMetricas();

  // Dados do funil de vendas usando dados reais - novas etapas
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
    return contatosLista
      .filter(contato => {
        if (!searchFilter) return true;
        const searchLower = searchFilter.toLowerCase();
        return (
          contato.nome.toLowerCase().includes(searchLower) ||
          contato.telefone.includes(searchLower) ||
          contato.email?.toLowerCase().includes(searchLower) ||
          contato.origem.toLowerCase().includes(searchLower)
        );
      })
      .map(contato => {
        // Buscar nome da prospecção se houver relacionamento
        const prospeccaoNome = prospeccoes.length > 0 ? prospeccoes[0].titulo : 'Sem prospecção';
        const prospeccaoCanal = prospeccoes.length > 0 ? prospeccoes[0].canal : 'Whatsapp';
        
        return {
          id: contato.id,
          title: contato.nome,
          description: `${contato.telefone}${contato.email ? ` - ${contato.email}` : ''}`,
          channel: contato.origem,
          assignee: contato.responsavel_id || undefined,
          prospeccaoNome, // Adicionar nome da prospecção
          prospeccaoCanal, // Adicionar canal da prospecção
          segmentacao: 'Undefined' // Buscar da tabela contatos quando implementar
        };
      });
  };

  // Configurar colunas do Kanban com dados reais - novas colunas
  const kanbanColumns: KanbanColumnData[] = [
    {
      id: 'novos',
      title: 'Novos',
      color: '#6645EB',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Novo'))
    },
    {
      id: 'atribuidos',
      title: 'Atribuídos',
      color: '#8B5FD6',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Enviado'))
    },
    {
      id: 'convidados',
      title: 'Convidados',
      color: '#A679E1',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Recebido'))
    },
    {
      id: 'agendados',
      title: 'Agendados',
      color: '#C193EC',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Agendado'))
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Confirmado'))
    },
    {
      id: 'checkin',
      title: 'Check-in',
      color: '#22c55e',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Cancelado'))
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
      console.log('Iniciando importação de contatos:', { campanha, quantidade: clientes.length });
      
      // Buscar o ID da prospecção pela campanha selecionada
      const prospeccaoSelecionada = prospeccoes.find(p => p.titulo === campanha);
      console.log('Prospecção selecionada:', prospeccaoSelecionada);
      
      if (!prospeccaoSelecionada) {
        throw new Error(`Prospecção "${campanha}" não encontrada`);
      }
      
      const novosContatos = clientes.map(cliente => ({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        origem: 'Outros' as const,
        observacoes: `Importado da campanha: ${campanha}`,
      }));

      console.log('Contatos preparados para inserção:', novosContatos);
      
      const result = await adicionarContatos(novosContatos, prospeccaoSelecionada?.id);
      console.log('Resultado da inserção:', result);

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
    // Criar um novo contato quando adicionar item via Kanban
    const novoContato = {
      nome: item.title,
      telefone: item.description || 'N/A',
      origem: 'Outros' as const,
      observacoes: 'Adicionado pelo Kanban'
    };

    adicionarContatos([novoContato]);
  };

  const handleEditItem = (item: KanbanItem) => {
    console.log('Edit item:', item);
  };

  const handleDeleteItem = (itemId: string) => {
    // TODO: Implementar exclusão do contato no banco
    console.log('Delete item:', itemId);
  };

  const [modalContato, setModalContato] = useState<{ isOpen: boolean; contato: Contato | null; columnId?: string }>({
    isOpen: false,
    contato: null,
    columnId: undefined
  });

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
        contato => contato.status === 'Enviado' && contato.responsavel_id === user.id
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
        contato => contato.status === 'Novo' && !contato.responsavel_id
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
        await atribuirResponsavel(contato.id, user.id);
        // Mover para coluna "Atribuídos" (status 'Enviado')
        await atualizarStatusContato(contato.id, 'Enviado');
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

  if (loading) {
    return (
      <DashboardLayout title="Prospecção">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

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
                        <div key={item.id} className={`border rounded-lg p-4 hover:bg-muted/50 ${
                          item.canal === 'Whatsapp' 
                            ? 'border-t-4 border-t-green-500' 
                            : 'border-t-4 border-t-blue-500'
                        }`}>
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id={`prospect-${item.id}`}
                              checked={selectedProspections.includes(item.id)}
                              onCheckedChange={(checked) => handleProspectionSelection(item.id, !!checked)}
                            />
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{item.titulo}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.canal === 'Whatsapp'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {item.canal}
                                </span>
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
                        </div>
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
        onOpenChange={setIsModalOpen}
        onProspeccaoCriada={refetch}
      />

      <ContatoModal
        isOpen={modalContato.isOpen}
        onClose={handleCloseModal}
        contato={modalContato.contato}
        columnId={modalContato.columnId}
        onStatusChange={handleModalStatusChange}
        onDelete={handleModalDelete}
        onAssignResponsible={handleModalAssignResponsible}
      />
    </DashboardLayout>
  );
};

export default Prospeccao;
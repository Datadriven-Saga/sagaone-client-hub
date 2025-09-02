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
import { useAuth } from "@/contexts/AuthContext";
import { useProspeccaoLogs } from "@/hooks/useProspeccaoLogs";
import { useContatoData, kanbanStatusMap } from "@/hooks/useContatoData";
import { useToast } from "@/components/ui/use-toast";

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
}

const Prospeccao = () => {
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { registrarMovimentacao } = useProspeccaoLogs();
  const { contatos, prospeccoes, loading, adicionarContatos, atualizarStatusContato, getMetricas, updateDateFilter, criarProspeccao, refetch } = useContatoData();

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

  // Dados do funil de vendas usando dados reais
  const funnelData: FunnelStage[] = [
    {
      id: 'total-base',
      title: 'Total da Base',
      value: metricas.totalBase,
      color: '#1f2937'
    },
    {
      id: 'enviados',
      title: 'Enviados',
      value: metricas.enviados,
      color: '#8B5FD6'
    },
    {
      id: 'recebidos',
      title: 'Recebidos',
      value: metricas.recebidos,
      color: '#A679E1'
    },
    {
      id: 'respondidos',
      title: 'Respondidos',
      value: metricas.respondidos,
      color: '#a855f7'
    },
    {
      id: 'agendados',
      title: 'Agendados',
      value: metricas.agendados,
      color: '#c084fc'
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      value: metricas.confirmados,
      color: '#10b981'
    }
  ];

  // Converter contatos para itens do Kanban
  const contatosToKanbanItems = (contatosLista: typeof contatos): KanbanItem[] => {
    return contatosLista.map(contato => ({
      id: contato.id,
      title: contato.nome,
      description: `${contato.telefone}${contato.email ? ` - ${contato.email}` : ''}`,
      channel: contato.origem,
      priority: 'medium' as const,
      assignee: contato.responsavel_id || undefined
    }));
  };

  // Configurar colunas do Kanban com dados reais
  const kanbanColumns: KanbanColumnData[] = [
    {
      id: 'novo',
      title: 'Novo',
      color: '#6645EB',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Novo'))
    },
    {
      id: 'enviados',
      title: 'Enviados',
      color: '#8B5FD6',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Negociação'))
    },
    {
      id: 'recebidos',
      title: 'Recebidos',
      color: '#A679E1',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Em Contato'))
    },
    {
      id: 'respondidos',
      title: 'Respondidos',
      color: '#C193EC',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Qualificado'))
    },
    {
      id: 'agendados',
      title: 'Agendados',
      color: '#DCADF7',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Proposta'))
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Fechado'))
    },
    {
      id: 'cancelados',
      title: 'Cancelados',
      color: '#EF4444',
      items: contatosToKanbanItems(contatos.filter(contato => contato.status === 'Perdido'))
    }
  ];

  // Função para importar clientes como contatos
  const handleClientesImported = async (campanha: string, clientes: ClienteData[]) => {
    try {
      // Buscar o ID da prospecção pela campanha selecionada
      const prospeccaoSelecionada = prospeccoes.find(p => p.titulo === campanha);
      
      const novosContatos = clientes.map(cliente => ({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        origem: 'Outros' as const,
        observacoes: `Importado da campanha: ${campanha}`
      }));

      await adicionarContatos(novosContatos, prospeccaoSelecionada?.id);

      toast({
        title: "Planilha importada",
        description: `${clientes.length} contatos foram importados e adicionados ao Kanban`,
      });
    } catch (error) {
      console.error('Erro ao importar contatos:', error);
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

  const handleCardClick = (item: KanbanItem) => {
    console.log('Abrir detalhes do card:', item);
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
            onDateRangeChange={updateDateFilter}
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
                        <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id={`prospect-${item.id}`}
                              checked={selectedProspections.includes(item.id)}
                              onCheckedChange={(checked) => handleProspectionSelection(item.id, !!checked)}
                            />
                            
                            <div className="flex-1">
                              <h4 className="font-semibold">{item.titulo}</h4>
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

        <TabsContent value="kanban" className="space-y-3">
          <FilterBar
            searchPlaceholder="Buscar por cliente, campanha ou status..."
          />
          
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Kanban - Gestão da Prospecção</h3>
              <div className="text-sm text-muted-foreground">
                Total de contatos: {contatos.length}
              </div>
            </div>
            
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={() => {}} // Será atualizado automaticamente pelos dados do banco
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onCardClick={handleCardClick}
              onStatusChange={handleStatusChange}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <CriarProspeccaoModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onProspeccaoCriada={refetch}
      />
    </DashboardLayout>
  );
};

export default Prospeccao;
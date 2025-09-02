import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/KPICard";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { SalesFunnel, FunnelStage } from "@/components/SalesFunnel";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Users, Send, MessageSquare, Calendar, CheckCircle, X, UserX } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { useState } from "react";

interface Prospection {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  brand: string;
  objective: number;
  status: string;
  metrics: {
    enviados: number;
    recebidos: number;
    respondidos: number;
    agendados: number;
    confirmados: number;
    cancelados: number;
    optOut: number;
    vendas: number;
  };
}

const Prospeccao = () => {
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);

  const mockProspections: Prospection[] = [
    {
      id: "001",
      name: "Campanha Janeiro 2025",
      startDate: "01/01/2025",
      endDate: "31/01/2025",
      brand: "Honda",
      objective: 50,
      status: "Ativa",
      metrics: {
        enviados: 1200,
        recebidos: 1100,
        respondidos: 450,
        agendados: 45,
        confirmados: 22,
        cancelados: 10,
        optOut: 15,
        vendas: 8
      }
    },
    {
      id: "002",
      name: "Black Friday 2024",
      startDate: "25/11/2024", 
      endDate: "30/11/2024",
      brand: "Toyota",
      objective: 25,
      status: "Finalizada",
      metrics: {
        enviados: 900,
        recebidos: 850,
        respondidos: 350,
        agendados: 35,
        confirmados: 18,
        cancelados: 8,
        optOut: 12,
        vendas: 6
      }
    },
    {
      id: "003",
      name: "Promoção Fim de Ano",
      startDate: "15/12/2024",
      endDate: "31/12/2024",
      brand: "Volkswagen",
      objective: 30,
      status: "Ativa",
      metrics: {
        enviados: 800,
        recebidos: 750,
        respondidos: 300,
        agendados: 30,
        confirmados: 15,
        cancelados: 7,
        optOut: 10,
        vendas: 4
      }
    }
  ];

  // Calcular métricas consolidadas das prospecções selecionadas
  const getConsolidatedMetrics = () => {
    if (selectedProspections.length === 0) {
      // Se nenhuma prospecção selecionada, mostrar totais de todas
      return mockProspections.reduce((acc, prospect) => ({
        enviados: acc.enviados + prospect.metrics.enviados,
        recebidos: acc.recebidos + prospect.metrics.recebidos,
        respondidos: acc.respondidos + prospect.metrics.respondidos,
        agendados: acc.agendados + prospect.metrics.agendados,
        confirmados: acc.confirmados + prospect.metrics.confirmados,
        cancelados: acc.cancelados + prospect.metrics.cancelados,
        optOut: acc.optOut + prospect.metrics.optOut,
        vendas: acc.vendas + prospect.metrics.vendas
      }), {
        enviados: 0, recebidos: 0, respondidos: 0, agendados: 0,
        confirmados: 0, cancelados: 0, optOut: 0, vendas: 0
      });
    }

    return mockProspections
      .filter(p => selectedProspections.includes(p.id))
      .reduce((acc, prospect) => ({
        enviados: acc.enviados + prospect.metrics.enviados,
        recebidos: acc.recebidos + prospect.metrics.recebidos,
        respondidos: acc.respondidos + prospect.metrics.respondidos,
        agendados: acc.agendados + prospect.metrics.agendados,
        confirmados: acc.confirmados + prospect.metrics.confirmados,
        cancelados: acc.cancelados + prospect.metrics.cancelados,
        optOut: acc.optOut + prospect.metrics.optOut,
        vendas: acc.vendas + prospect.metrics.vendas
      }), {
        enviados: 0, recebidos: 0, respondidos: 0, agendados: 0,
        confirmados: 0, cancelados: 0, optOut: 0, vendas: 0
      });
  };

  const consolidatedMetrics = getConsolidatedMetrics();

  const funnelStages: FunnelStage[] = [
    {
      id: 'enviados',
      title: 'Enviados',
      value: consolidatedMetrics.enviados,
      color: '#6366f1'
    },
    {
      id: 'recebidos',
      title: 'Recebidos',
      value: consolidatedMetrics.recebidos,
      color: '#8b5cf6'
    },
    {
      id: 'respondidos',
      title: 'Respondidos',
      value: consolidatedMetrics.respondidos,
      color: '#a855f7'
    },
    {
      id: 'agendados',
      title: 'Agendados',
      value: consolidatedMetrics.agendados,
      color: '#c084fc'
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      value: consolidatedMetrics.confirmados,
      color: '#10b981'
    },
    {
      id: 'vendas',
      title: 'Vendas',
      value: consolidatedMetrics.vendas,
      color: '#059669'
    }
  ];

  const kpis = [
    { title: "Enviados", value: consolidatedMetrics.enviados.toLocaleString(), icon: Send },
    { title: "Recebidos", value: consolidatedMetrics.recebidos.toLocaleString(), icon: MessageSquare },
    { title: "Respondidos", value: consolidatedMetrics.respondidos.toLocaleString(), icon: MessageSquare },
    { title: "Agendados", value: consolidatedMetrics.agendados.toLocaleString(), icon: Calendar },
    { title: "Confirmados", value: consolidatedMetrics.confirmados.toLocaleString(), icon: CheckCircle },
    { title: "Cancelados", value: consolidatedMetrics.cancelados.toLocaleString(), icon: X },
    { title: "Opt-Out", value: consolidatedMetrics.optOut.toLocaleString(), icon: UserX },
    { title: "Vendas", value: consolidatedMetrics.vendas.toLocaleString(), icon: Target }
  ];

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnData[]>([
    {
      id: 'novo',
      title: 'Novo',
      color: '#6645EB',
      items: [
        {
          id: '1',
          title: 'João Silva',
          description: 'Interessado em Honda Civic',
          channel: 'WhatsApp',
          priority: 'high',
          assignee: 'Maria Santos'
        },
        {
          id: '2',
          title: 'Ana Costa',
          description: 'Consultou sobre financiamento',
          channel: 'Site',
          priority: 'medium',
          assignee: 'Pedro Lima'
        }
      ]
    },
    {
      id: 'enviados',
      title: 'Enviados',
      color: '#8B5FD6',
      items: [
        {
          id: '3',
          title: 'Carlos Oliveira',
          description: 'Primeira mensagem enviada',
          channel: 'E-mail',
          dueDate: '25/01',
          assignee: 'Julia Mendes'
        }
      ]
    },
    {
      id: 'recebidos',
      title: 'Recebidos',
      color: '#A679E1',
      items: [
        {
          id: '4',
          title: 'Fernanda Rocha',
          description: 'Respondeu interesse em test drive',
          channel: 'WhatsApp',
          tags: ['Test Drive'],
          priority: 'high',
          assignee: 'Roberto Santos'
        }
      ]
    },
    {
      id: 'respondidos',
      title: 'Respondidos',
      color: '#C193EC',
      items: []
    },
    {
      id: 'agendados',
      title: 'Agendados',
      color: '#DCADF7',
      items: [
        {
          id: '5',
          title: 'Ricardo Ferreira',
          description: 'Test drive agendado',
          channel: 'Telefone',
          dueDate: '26/01',
          tags: ['Test Drive', 'Honda Civic'],
          priority: 'high',
          assignee: 'Ana Paula'
        }
      ]
    },
    {
      id: 'confirmados',
      title: 'Confirmados',
      color: '#10B981',
      items: []
    },
    {
      id: 'cancelados',
      title: 'Cancelados',
      color: '#EF4444',
      items: []
    },
    {
      id: 'opt-out',
      title: 'Opt-Out',
      color: '#6B7280',
      items: []
    }
  ]);

  const handleProspectionSelection = (prospectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedProspections(prev => [...prev, prospectionId]);
    } else {
      setSelectedProspections(prev => prev.filter(id => id !== prospectionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProspections(mockProspections.map(p => p.id));
    } else {
      setSelectedProspections([]);
    }
  };

  const handleAddItem = (columnId: string, item: Omit<KanbanItem, 'id'>) => {
    const newItem: KanbanItem = {
      ...item,
      id: `${Date.now()}-${Math.random()}`
    };

    setKanbanColumns(columns =>
      columns.map(col =>
        col.id === columnId
          ? { ...col, items: [...col.items, newItem] }
          : col
      )
    );
  };

  const handleEditItem = (item: KanbanItem) => {
    console.log('Edit item:', item);
  };

  const handleDeleteItem = (itemId: string) => {
    setKanbanColumns(columns =>
      columns.map(col => ({
        ...col,
        items: col.items.filter(item => item.id !== itemId)
      }))
    );
  };

  const handleCardClick = (item: KanbanItem) => {
    console.log('Abrir detalhes do card:', item);
  };

  return (
    <DashboardLayout title="Prospecção">
      <Tabs defaultValue="visao-geral" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-3">
          {/* Filtros */}
          <FilterBar
            searchPlaceholder="Filtrar prospecções por nome, marca ou status..."
          />

          {/* Layout: Funil à esquerda, Lista à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil de Vendas - Metade Esquerda */}
            <div className="order-2 lg:order-1">
              <SalesFunnel 
                stages={funnelStages}
                title={`Funil de Vendas ${
                  selectedProspections.length > 0 
                    ? `(${selectedProspections.length} prospecção${selectedProspections.length > 1 ? 'ões' : ''} selecionada${selectedProspections.length > 1 ? 's' : ''})`
                    : '(Todas as prospecções)'
                }`}
              />
            </div>

            {/* Lista de Prospecções - Metade Direita */}
            <div className="order-1 lg:order-2 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Prospecções</h3>
                  <Button>Nova Prospecção</Button>
                </div>

                {/* Seleção Geral */}
                <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-muted">
                  <Checkbox 
                    id="select-all"
                    checked={selectedProspections.length === mockProspections.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <label 
                    htmlFor="select-all" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Selecionar todas ({mockProspections.length})
                  </label>
                </div>

                {/* Lista de Prospecções */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {mockProspections.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id={`prospect-${item.id}`}
                          checked={selectedProspections.includes(item.id)}
                          onCheckedChange={(checked) => handleProspectionSelection(item.id, !!checked)}
                        />
                        
                        <div className="flex-1 cursor-pointer" onClick={() => console.log('Abrir prospecção:', item)}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{item.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {item.startDate} - {item.endDate} | {item.brand}
                              </p>
                              <p className="text-sm">Objetivo: {item.objective} vendas</p>
                              <div className="text-xs text-muted-foreground mt-1">
                                Enviados: {item.metrics.enviados.toLocaleString()} | 
                                Vendas: {item.metrics.vendas}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-1 rounded text-xs ${
                                item.status === 'Ativa' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* KPIs - Abaixo do layout principal */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {kpis.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi.title}
                value={kpi.value}
                icon={kpi.icon}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="space-y-3">
          <FilterBar
            searchPlaceholder="Buscar por cliente, campanha ou status..."
          />
          
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Gestão da Prospecção</h3>
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={setKanbanColumns}
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onCardClick={handleCardClick}
            />
          </Card>
        </TabsContent>

        <TabsContent value="automacao" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Automação e Carga de Clientes</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Carga de Clientes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Users className="mx-auto mb-2" size={24} />
                      <p>Usar Base Existente</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Send className="mx-auto mb-2" size={24} />
                      <p>Upload de Planilha</p>
                    </div>
                  </Button>
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
      </Tabs>
    </DashboardLayout>
  );
};

export default Prospeccao;
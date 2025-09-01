import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/KPICard";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { Target, Users, Send, MessageSquare, Calendar, CheckCircle, X, UserX } from "lucide-react";
import { useState } from "react";

const Prospeccao = () => {
  const kpis = [
    { title: "Enviados", value: "2,100", subtitle: "21.000%", icon: Send },
    { title: "Recebidos", value: "2,000", subtitle: "20.000%", icon: MessageSquare },
    { title: "Respondidos", value: "800", subtitle: "8.000%", icon: MessageSquare },
    { title: "Agendados", value: "80", subtitle: "800%", icon: Calendar },
    { title: "Confirmados", value: "40", subtitle: "400%", icon: CheckCircle },
    { title: "Cancelados", value: "20", subtitle: "200%", icon: X },
    { title: "Opt-Out", value: "31", subtitle: "315%", icon: UserX },
    { title: "Objetivo de Vendas", value: "10", subtitle: "100%", icon: Target }
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

  const mockProspections = [
    {
      id: "001",
      name: "Campanha Janeiro 2025",
      startDate: "01/01/2025",
      endDate: "31/01/2025",
      brand: "Honda",
      objective: 50,
      status: "Ativa"
    },
    {
      id: "002",
      name: "Black Friday 2024",
      startDate: "25/11/2024", 
      endDate: "30/11/2024",
      brand: "Toyota",
      objective: 25,
      status: "Finalizada"
    }
  ];

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
    // Implementar modal de edição
  };

  const handleDeleteItem = (itemId: string) => {
    setKanbanColumns(columns =>
      columns.map(col => ({
        ...col,
        items: col.items.filter(item => item.id !== itemId)
      }))
    );
  };

  return (
    <DashboardLayout title="Prospecção">
      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="criar">Criar Prospecção</TabsTrigger>
          <TabsTrigger value="gestao">Gestão</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {/* Seletor de Prospecção */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Selecionar Prospecção</h3>
            <select className="w-full p-3 border rounded-lg bg-card">
              <option value="">Selecione uma prospecção</option>
              {mockProspections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.brand}
                </option>
              ))}
            </select>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi.title}
                value={kpi.value}
                subtitle={kpi.subtitle}
                icon={kpi.icon}
              />
            ))}
          </div>

          {/* Lista de Prospecções */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Prospecções Criadas</h3>
            <div className="space-y-4">
              {mockProspections.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.startDate} - {item.endDate} | {item.brand}
                      </p>
                      <p className="text-sm">Objetivo: {item.objective} vendas</p>
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
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="criar" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">Criar Nova Prospecção</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nome da Prospecção</label>
                <input type="text" className="w-full p-3 border rounded-lg" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Marca</label>
                <select className="w-full p-3 border rounded-lg">
                  <option>Honda</option>
                  <option>Toyota</option>
                  <option>Volkswagen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data de Início</label>
                <input type="date" className="w-full p-3 border rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data de Fim</label>
                <input type="date" className="w-full p-3 border rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Hora do Evento</label>
                <input type="time" className="w-full p-3 border rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Local do Evento</label>
                <input type="text" className="w-full p-3 border rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Objetivo de Vendas</label>
                <input type="number" className="w-full p-3 border rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Lojas Participantes</label>
                <input type="text" className="w-full p-3 border rounded-lg" placeholder="Opcional" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Condições Especiais</label>
                <textarea className="w-full p-3 border rounded-lg" rows={3}></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Imagem de Divulgação</label>
                <input type="file" className="w-full p-3 border rounded-lg" accept="image/*" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Vídeo de Divulgação</label>
                <input type="file" className="w-full p-3 border rounded-lg" accept="video/*" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button className="px-8">Salvar Prospecção</Button>
              <Button variant="outline">Cancelar</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gestao" className="space-y-6">
          <Card className="p-6 h-[800px]">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Gestão da Prospecção</h3>
            <KanbanBoard
              columns={kanbanColumns}
              onUpdateColumns={setKanbanColumns}
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
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

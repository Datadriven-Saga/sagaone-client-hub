import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { useState } from "react";

import { FilterBar } from "@/components/FilterBar";

const Loja = () => {
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnData[]>([
    {
      id: 'novo',
      title: 'Novo',
      items: [
        { id: '1', title: 'Cliente Potencial A', description: 'Interessado em produtos premium', channel: 'Prospecção', priority: 'high' },
        { id: '2', title: 'Lead Site B', description: 'Consultou página de preços', channel: 'Site', priority: 'medium' }
      ]
    },
    {
      id: 'em-andamento',
      title: 'Em Andamento',
      items: [
        { id: '3', title: 'Cliente C', description: 'Demonstração agendada', channel: 'WhatsApp', priority: 'high' },
        { id: '4', title: 'Lead D', description: 'Aguardando proposta', channel: 'WhatsApp', priority: 'medium' },
        { id: '5', title: 'Cliente E', description: 'Negociando valores', channel: 'WhatsApp', priority: 'medium' }
      ]
    },
    {
      id: 'agendamento',
      title: 'Agendamento',
      items: [
        { id: '6', title: 'Cliente F', description: 'Visita marcada para esta semana', channel: 'Presencial', priority: 'high' }
      ]
    },
    {
      id: 'concluido',
      title: 'Concluído',
      items: [
        { id: '7', title: 'Cliente G', description: 'Venda realizada com sucesso', channel: 'Presencial', priority: 'high' },
        { id: '8', title: 'Cliente H', description: 'Contrato assinado', channel: 'Presencial', priority: 'high' }
      ]
    },
    {
      id: 'cancelado',
      title: 'Cancelado',
      items: [
        { id: '9', title: 'Lead I', description: 'Não teve interesse', channel: 'Telefone', priority: 'low' }
      ]
    }
  ]);

  const handleAddItem = (columnId: string, item: Omit<KanbanItem, 'id'>) => {
    const newItem: KanbanItem = {
      ...item,
      id: `item-${Date.now()}`
    };
    
    setKanbanColumns(columns => columns.map(col => 
      col.id === columnId 
        ? { ...col, items: [...col.items, newItem] }
        : col
    ));
  };

  const handleEditItem = (item: KanbanItem) => {
    // Implementar edição
    console.log('Editar item:', item);
  };

  const handleDeleteItem = (itemId: string) => {
    setKanbanColumns(columns => columns.map(col => ({
      ...col,
      items: col.items.filter(item => item.id !== itemId)
    })));
  };

  const kpis = [
    { title: "Total de Leads", value: "890", icon: Users },
    { title: "Leads Novos", value: "120", subtitle: "13.5%", icon: UserPlus },
    { title: "Em Andamento", value: "280", subtitle: "31.5%", icon: Clock },
    { title: "Agendados", value: "95", subtitle: "10.7%", icon: Calendar },
    { title: "Concluídos", value: "315", subtitle: "35.4%", icon: CheckCircle },
    { title: "Cancelados", value: "80", subtitle: "9%", icon: X }
  ];

  const originData = [
    { name: "Prospecção", value: 300, color: "#6645EB" },
    { name: "Site", value: 250, color: "#8B5FD6" },
    { name: "Indicação", value: 200, color: "#A679E1" },
    { name: "Walk-in", value: 140, color: "#C193EC" }
  ];

  const channelData = [
    { name: "WhatsApp", value: 400, color: "#6645EB" },
    { name: "Presencial", value: 300, color: "#8B5FD6" },
    { name: "Telefone", value: 190, color: "#A679E1" }
  ];

  const handleCardClick = (item: KanbanItem) => {
    // Abrir modal conforme instruções iniciais
    console.log('Abrir detalhes da loja:', item);
  };

  return (
    <DashboardLayout title="Loja">
      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Leads por Origem</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={originData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {originData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Leads por Canal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="atendimento" className="space-y-3">
          <FilterBar
            searchPlaceholder="Buscar por cliente, produto ou status..."
          />
          
          <Card className="p-4 h-[600px]">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Atendimento</h3>
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
      </Tabs>
    </DashboardLayout>
  );
};

export default Loja;
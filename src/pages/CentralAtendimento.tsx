import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { FilterBar } from "@/components/FilterBar";
import { useState } from "react";

const CentralAtendimento = () => {
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnData[]>([
    {
      id: 'novo',
      title: 'Novo',
      items: [
        { id: '1', title: 'Maria Silva', description: 'Interessada em plano familiar', channel: 'WhatsApp', priority: 'high' },
        { id: '2', title: 'João Santos', description: 'Plano empresarial', channel: 'WhatsApp', priority: 'medium' },
        { id: '3', title: 'Ana Costa', description: 'Informações sobre cobertura', channel: 'WhatsApp', priority: 'low' }
      ]
    },
    {
      id: 'em-andamento',
      title: 'Em Andamento',
      items: [
        { id: '4', title: 'Carlos Lima', description: 'Negociando condições', channel: 'Telefone', priority: 'high' },
        { id: '5', title: 'Fernanda Oliveira', description: 'Documentação pendente', channel: 'Telefone', priority: 'medium' }
      ]
    },
    {
      id: 'agendamento',
      title: 'Agendamento',
      items: [
        { id: '6', title: 'Roberto Pereira', description: 'Visita técnica agendada', channel: 'E-mail', priority: 'medium' }
      ]
    },
    {
      id: 'concluido',
      title: 'Concluído',
      items: [
        { id: '7', title: 'Luciana Rocha', description: 'Contrato assinado', channel: 'Presencial', priority: 'high' }
      ]
    },
    {
      id: 'cancelado',
      title: 'Cancelado',
      items: [
        { id: '8', title: 'Pedro Mendes', description: 'Desistiu do plano', channel: 'WhatsApp', priority: 'low' }
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
    { title: "Total de Leads", value: "1,250", icon: Users },
    { title: "Leads Novos", value: "180", subtitle: "14.4%", icon: UserPlus },
    { title: "Em Andamento", value: "420", subtitle: "33.6%", icon: Clock },
    { title: "Agendados", value: "150", subtitle: "12%", icon: Calendar },
    { title: "Concluídos", value: "380", subtitle: "30.4%", icon: CheckCircle },
    { title: "Cancelados", value: "120", subtitle: "9.6%", icon: X }
  ];

  const originData = [
    { name: "Site", value: 400, color: "#6645EB" },
    { name: "Facebook", value: 300, color: "#8B5FD6" },
    { name: "Google", value: 250, color: "#A679E1" },
    { name: "Indicação", value: 200, color: "#C193EC" },
    { name: "Outros", value: 100, color: "#DCADF7" }
  ];

  const channelData = [
    { name: "WhatsApp", value: 500, color: "#6645EB" },
    { name: "Telefone", value: 350, color: "#8B5FD6" },
    { name: "E-mail", value: 250, color: "#A679E1" },
    { name: "Presencial", value: 150, color: "#C193EC" }
  ];

  const handleCardClick = (item: KanbanItem) => {
    // Abrir modal conforme instruções iniciais
    console.log('Abrir detalhes do atendimento:', item);
  };

  return (
    <DashboardLayout title="Central de Atendimento">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* Filtros de Data */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Nome do cliente"
                className="p-3 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Telefone"
                className="p-3 border rounded-lg"
              />
              <select className="p-3 border rounded-lg">
                <option value="">Origem</option>
                <option value="site">Site</option>
                <option value="facebook">Facebook</option>
                <option value="google">Google</option>
              </select>
              <select className="p-3 border rounded-lg">
                <option value="">Canal</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telefone">Telefone</option>
                <option value="email">E-mail</option>
              </select>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="atendimento" className="space-y-3">
          <FilterBar
            searchPlaceholder="Buscar por lead, cliente ou status..."
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

export default CentralAtendimento;
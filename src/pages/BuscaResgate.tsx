import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";
import { KanbanBoard, KanbanColumnData, KanbanItem } from "@/components/KanbanBoard";
import { useState } from "react";

const BuscaResgate = () => {
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnData[]>([
    {
      id: 'novo',
      title: 'Novo',
      items: [
        { id: '1', title: 'Cliente Inativo A', description: 'Não compra há 6 meses', channel: 'Loja', priority: 'high' },
        { id: '2', title: 'Ex-cliente B', description: 'Cancelou contrato recentemente', channel: 'Loja', priority: 'medium' }
      ]
    },
    {
      id: 'em-andamento',
      title: 'Em Andamento',
      items: [
        { id: '3', title: 'Cliente C', description: 'Primeiro contato realizado', channel: 'WhatsApp', priority: 'high' },
        { id: '4', title: 'Cliente D', description: 'Oferta especial enviada', channel: 'WhatsApp', priority: 'medium' },
        { id: '5', title: 'Cliente E', description: 'Aguardando retorno', channel: 'WhatsApp', priority: 'medium' }
      ]
    },
    {
      id: 'agendamento',
      title: 'Agendamento',
      items: [
        { id: '6', title: 'Cliente F', description: 'Reunião de reativação agendada', channel: 'Telefone', priority: 'high' }
      ]
    },
    {
      id: 'concluido',
      title: 'Concluído',
      items: [
        { id: '7', title: 'Cliente G', description: 'Reativado com sucesso', channel: 'Telefone', priority: 'high' },
        { id: '8', title: 'Cliente H', description: 'Nova compra realizada', channel: 'Telefone', priority: 'high' }
      ]
    },
    {
      id: 'cancelado',
      title: 'Cancelado',
      items: [
        { id: '9', title: 'Ex-cliente I', description: 'Não demonstrou interesse', channel: 'E-mail', priority: 'low' }
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
    { title: "Total de Eventos", value: "456", icon: Users },
    { title: "Eventos Novos", value: "68", subtitle: "14.9%", icon: UserPlus },
    { title: "Em Andamento", value: "142", subtitle: "31.1%", icon: Clock },
    { title: "Agendados", value: "45", subtitle: "9.9%", icon: Calendar },
    { title: "Concluídos", value: "165", subtitle: "36.2%", icon: CheckCircle },
    { title: "Cancelados", value: "36", subtitle: "7.9%", icon: X }
  ];

  const originData = [
    { name: "Loja", value: 200, color: "#6645EB" },
    { name: "Pós-venda", value: 150, color: "#8B5FD6" },
    { name: "CRM", value: 106, color: "#A679E1" }
  ];

  const channelData = [
    { name: "WhatsApp", value: 250, color: "#6645EB" },
    { name: "Telefone", value: 120, color: "#8B5FD6" },
    { name: "E-mail", value: 86, color: "#A679E1" }
  ];

  return (
    <DashboardLayout title="Busca & Resgate">
      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h3 className="text-lg font-semibold text-foreground mb-4">Eventos por Origem</h3>
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
              <h3 className="text-lg font-semibold text-foreground mb-4">Eventos por Canal</h3>
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
                <option value="loja">Loja</option>
                <option value="pos-venda">Pós-venda</option>
                <option value="crm">CRM</option>
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

        <TabsContent value="atendimento" className="space-y-6">
          <KanbanBoard
            columns={kanbanColumns}
            onUpdateColumns={setKanbanColumns}
            onAddItem={handleAddItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default BuscaResgate;
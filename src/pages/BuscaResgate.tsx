import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";

const BuscaResgate = () => {
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
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Busca & Resgate</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Colunas do Kanban */}
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Novo</h4>
                  <span className="text-sm text-muted-foreground">12 eventos</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item}</p>
                      <p className="text-xs text-muted-foreground">Loja</p>
                      <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Em Andamento</h4>
                  <span className="text-sm text-muted-foreground">18 eventos</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 2}</p>
                      <p className="text-xs text-muted-foreground">Pós-venda</p>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Agendamento</h4>
                  <span className="text-sm text-muted-foreground">6 eventos</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 5}</p>
                      <p className="text-xs text-muted-foreground">CRM</p>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Concluído</h4>
                  <span className="text-sm text-muted-foreground">8 eventos</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 6}</p>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Cancelado</h4>
                  <span className="text-sm text-muted-foreground">2 eventos</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 8}</p>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default BuscaResgate;
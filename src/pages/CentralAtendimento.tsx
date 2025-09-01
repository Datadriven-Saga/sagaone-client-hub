import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";

const CentralAtendimento = () => {
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

  return (
    <DashboardLayout title="Central de Atendimento">
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

        <TabsContent value="atendimento" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Atendimento de Leads</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Colunas do Kanban */}
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Novo</h4>
                  <span className="text-sm text-muted-foreground">25 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item}</p>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Em Andamento</h4>
                  <span className="text-sm text-muted-foreground">18 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 3}</p>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Agendamento</h4>
                  <span className="text-sm text-muted-foreground">12 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 5}</p>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Concluído</h4>
                  <span className="text-sm text-muted-foreground">8 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 6}</p>
                      <p className="text-xs text-muted-foreground">Presencial</p>
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Cancelado</h4>
                  <span className="text-sm text-muted-foreground">5 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Cliente {item + 7}</p>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
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

export default CentralAtendimento;
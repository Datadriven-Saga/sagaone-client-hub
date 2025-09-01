import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserPlus, Clock, Calendar, CheckCircle, X } from "lucide-react";

const Loja = () => {
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

  return (
    <DashboardLayout title="Loja">
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
        </TabsContent>

        <TabsContent value="atendimento" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Kanban - Vendas</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Colunas do Kanban */}
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Novo</h4>
                  <span className="text-sm text-muted-foreground">15 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Lead {item}</p>
                      <p className="text-xs text-muted-foreground">Prospecção</p>
                      <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Em Andamento</h4>
                  <span className="text-sm text-muted-foreground">22 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Lead {item + 2}</p>
                      <p className="text-xs text-muted-foreground">Site</p>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Agendamento</h4>
                  <span className="text-sm text-muted-foreground">8 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Lead {item + 5}</p>
                      <p className="text-xs text-muted-foreground">Indicação</p>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Concluído</h4>
                  <span className="text-sm text-muted-foreground">12 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Lead {item + 6}</p>
                      <p className="text-xs text-muted-foreground">Walk-in</p>
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <h4 className="font-semibold">Cancelado</h4>
                  <span className="text-sm text-muted-foreground">3 leads</span>
                </div>
                
                <div className="space-y-2">
                  {[1].map((item) => (
                    <div key={item} className="bg-card p-3 rounded-lg border hover:shadow-sm cursor-pointer">
                      <p className="font-medium text-sm">Lead {item + 8}</p>
                      <p className="text-xs text-muted-foreground">Site</p>
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

export default Loja;
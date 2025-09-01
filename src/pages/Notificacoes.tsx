import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, BarChart3 } from "lucide-react";

const Notificacoes = () => {
  const kpis = [
    { title: "Atrasadas", value: "23", icon: AlertCircle, trend: "down" as const },
    { title: "Pendentes", value: "156", icon: Clock },
    { title: "Realizadas", value: "342", icon: CheckCircle, trend: "up" as const },
    { title: "Total", value: "521", icon: BarChart3 }
  ];

  const mockNotifications = [
    {
      id: "001",
      type: "Aniversário",
      clientName: "João Silva",
      eventDate: "15/01/2025",
      lastPurchase: "15/12/2023",
      lastVehicle: "Honda Civic 2023",
      status: "Atrasada"
    },
    {
      id: "002",
      type: "Recompra", 
      clientName: "Ana Costa",
      eventDate: "20/01/2025",
      lastPurchase: "10/11/2023",
      lastVehicle: "Toyota Corolla 2022",
      status: "Pendente"
    },
    {
      id: "003",
      type: "Revisão",
      clientName: "Carlos Santos",
      eventDate: "12/01/2025", 
      lastPurchase: "05/08/2023",
      lastVehicle: "Volkswagen Jetta 2023",
      status: "Realizada"
    }
  ];

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      "Atrasada": "destructive",
      "Pendente": "secondary", 
      "Realizada": "default"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="Notificações">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
          />
        ))}
      </div>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Tipo da Notificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aniversario">Aniversário</SelectItem>
              <SelectItem value="recompra">Recompra</SelectItem>
              <SelectItem value="revisao">Revisão</SelectItem>
              <SelectItem value="financiamento">Financiamento</SelectItem>
              <SelectItem value="entrega">Entrega</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="Nome do cliente" />

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="atrasadas">Atrasadas</SelectItem>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="realizadas">Realizadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-3 mt-4">
          <Button variant="outline">Limpar Filtros</Button>
          <Button>Aplicar Filtros</Button>
        </div>
      </Card>

      {/* Notifications Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-foreground">Lista de Notificações</h3>
          <Button>Nova Notificação</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nome do Cliente</TableHead>
              <TableHead>Data do Evento</TableHead>
              <TableHead>Data Última Compra</TableHead>
              <TableHead>Último Veículo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockNotifications.map((notification) => (
              <TableRow key={notification.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">{notification.id}</TableCell>
                <TableCell>{notification.type}</TableCell>
                <TableCell>{notification.clientName}</TableCell>
                <TableCell>{notification.eventDate}</TableCell>
                <TableCell>{notification.lastPurchase}</TableCell>
                <TableCell>{notification.lastVehicle}</TableCell>
                <TableCell>{getStatusBadge(notification.status)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </DashboardLayout>
  );
};

export default Notificacoes;
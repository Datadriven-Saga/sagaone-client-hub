import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/DateRangePicker";
import { AlertCircle, Clock, CheckCircle, BarChart3 } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { useNotificacoesData } from "@/hooks/useNotificacoesData";

const Notificacoes = () => {
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { notificacoes: notificacoesList, kpis: kpisData, loading } = useNotificacoesData();
  
  const kpis = [
    { title: "Atrasadas", value: loading ? "..." : kpisData.atrasadas.toString(), icon: AlertCircle, trend: "down" as const },
    { title: "Pendentes", value: loading ? "..." : kpisData.pendentes.toString(), icon: Clock },
    { title: "Realizadas", value: loading ? "..." : kpisData.realizadas.toString(), icon: CheckCircle, trend: "up" as const },
    { title: "Total", value: loading ? "..." : kpisData.total.toString(), icon: BarChart3 }
  ];


  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      "Atrasada": "destructive",
      "Pendente": "secondary", 
      "Realizada": "default"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const handleOpenNotification = (notification: any) => {
    setSelectedNotification(notification);
    setIsNotificationDialogOpen(true);
  };

  return (
    <DashboardLayout title="Notificações">
      <div className="space-y-3">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Nome do cliente" />

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

            <DateRangePicker 
              date={dateRange}
              onDateChange={setDateRange}
              placeholder="Período"
            />
          </div>
        </Card>

        {/* KPIs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

        {/* Notifications Table */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">Lista de Notificações</h3>
            <Button>Nova Notificação</Button>
          </div>

          <div className="overflow-x-auto">
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Carregando notificações...
                    </TableCell>
                  </TableRow>
                ) : notificacoesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Nenhuma notificação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  notificacoesList.map((notification) => (
                    <TableRow key={notification.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{notification.id}</TableCell>
                      <TableCell>{notification.type}</TableCell>
                      <TableCell>{notification.clientName}</TableCell>
                      <TableCell>{notification.eventDate}</TableCell>
                      <TableCell>{notification.lastPurchase}</TableCell>
                      <TableCell>{notification.lastVehicle}</TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenNotification(notification)}
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Dialog para Detalhes da Notificação */}
        <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Detalhes da Notificação - {selectedNotification?.type}
              </DialogTitle>
            </DialogHeader>
            
            {selectedNotification && (
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-sm">{selectedNotification.clientName}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data do Evento</Label>
                  <p className="text-sm">{selectedNotification.eventDate}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Último Veículo</Label>
                  <p className="text-sm">{selectedNotification.lastVehicle}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Mensagem Padrão</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {selectedNotification.type === 'Aniversário' && 
                      `Olá ${selectedNotification.clientName}! 🎉 Parabéns pelo seu aniversário! Que tal celebrar com um novo veículo? Venha nos visitar!`}
                    {selectedNotification.type === 'Recompra' && 
                      `Olá ${selectedNotification.clientName}! Notamos que está na hora de pensar em renovar seu ${selectedNotification.lastVehicle}. Temos ótimas condições para você!`}
                    {selectedNotification.type === 'Revisão' && 
                      `Olá ${selectedNotification.clientName}! Está na hora da revisão do seu ${selectedNotification.lastVehicle}. Agende já!`}
                  </div>
                </div>

                <div>
                  <Label htmlFor="justificativa">Justificativa da Ação</Label>
                  <Textarea 
                    id="justificativa"
                    placeholder="Descreva brevemente a ação realizada..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsNotificationDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setIsNotificationDialogOpen(false)}>
                    Confirmar Ação Realizada
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Notificacoes;
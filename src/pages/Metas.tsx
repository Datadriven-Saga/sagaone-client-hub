import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Metas = () => {
  const prospectionGoals = [
    { stage: "Vendas", quantity: 1, percentage: "100%" },
    { stage: "Confirmados", quantity: 4, percentage: "400%" },
    { stage: "Agendados", quantity: 8, percentage: "800%" },
    { stage: "Respondidos", quantity: 80, percentage: "8.000%" },
    { stage: "Recebidos", quantity: 200, percentage: "20.000%" },
    { stage: "Enviados", quantity: 210, percentage: "21.000%" },
    { stage: "Opt-out", quantity: 3.15, percentage: "315%" }
  ];

  return (
    <DashboardLayout title="Metas e OKR">
      <Tabs defaultValue="prospeccao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prospeccao">Metas de Prospecção</TabsTrigger>
          <TabsTrigger value="leads">Metas de Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="prospeccao" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Configuração de Metas de Prospecção
            </h3>
            <p className="text-muted-foreground mb-6">
              Defina a estimativa de quantidade de pessoas necessárias para realizar 1 venda em cada etapa.
            </p>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Etapa</TableHead>
                    <TableHead className="w-1/3">Quantidade</TableHead>
                    <TableHead className="w-1/3">% sobre Vendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectionGoals.map((goal) => (
                    <TableRow key={goal.stage}>
                      <TableCell className="font-medium">{goal.stage}</TableCell>
                      <TableCell>
                        {goal.stage === 'Vendas' ? (
                          <span className="text-muted-foreground">{goal.quantity}</span>
                        ) : (
                          <Input
                            type="number"
                            defaultValue={goal.quantity}
                            className="w-24"
                            step={goal.stage === 'Opt-out' ? '0.01' : '1'}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{goal.percentage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-6">
              <Button>Salvar Configurações</Button>
            </div>

            <div className="mt-8 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Como funciona:</h4>
              <p className="text-sm text-muted-foreground">
                O sistema utiliza essas configurações para calcular automaticamente as metas de cada etapa 
                com base no objetivo de vendas definido na criação de uma prospecção. Por exemplo, se o 
                objetivo é 10 vendas, o sistema calculará que são necessários 40 confirmados, 80 agendados, etc.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Metas Mensais de Leads
            </h3>
            <p className="text-muted-foreground mb-6">
              Defina as metas mensais para os indicadores de leads.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Quantidade e Origem</h4>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Quantidade Total</label>
                  <Input type="number" placeholder="Ex: 500" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Internet</label>
                  <Input type="number" placeholder="Ex: 40" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Showroom</label>
                  <Input type="number" placeholder="Ex: 35" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Prospecção</label>
                  <Input type="number" placeholder="Ex: 25" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Conversão</h4>
                
                <div>
                  <label className="block text-sm font-medium mb-2">% Conversão Total</label>
                  <Input type="number" placeholder="Ex: 15" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Conversão Internet</label>
                  <Input type="number" placeholder="Ex: 12" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Conversão Showroom</label>
                  <Input type="number" placeholder="Ex: 18" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">% Conversão Prospecção</label>
                  <Input type="number" placeholder="Ex: 20" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Tempos Médios (em minutos)</h4>
                
                <div>
                  <label className="block text-sm font-medium mb-2">TME - Tempo Médio de Espera</label>
                  <Input type="number" placeholder="Ex: 30" step="1" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">TMQ - Tempo Médio de Qualificação</label>
                  <Input type="number" placeholder="Ex: 90" step="1" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">TMA - Tempo Médio de Atendimento</label>
                  <Input type="number" placeholder="Ex: 120" step="1" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">TMN - Tempo Médio de Negociação</label>
                  <Input type="number" placeholder="Ex: 240" step="1" />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button>Salvar Metas</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Metas;
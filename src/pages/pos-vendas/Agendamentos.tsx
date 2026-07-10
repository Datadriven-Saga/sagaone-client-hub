import { DashboardLayout } from "@/components/DashboardLayout";
import { AgendamentosTab } from "@/components/pos-vendas/AgendamentosTab";
import { ConfiguracoesPosVendasTab } from "@/components/pos-vendas/ConfiguracoesPosVendasTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Agendamentos() {
  return (
    <DashboardLayout title="Pós-Vendas">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Pós-Vendas</h1>
          <p className="text-sm text-muted-foreground">Agendamentos e configurações da Paty.</p>
        </div>
        <Tabs defaultValue="agendamentos" className="space-y-3">
          <TabsList className="justify-start w-auto inline-flex">
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="agendamentos" className="space-y-4">
            <AgendamentosTab />
          </TabsContent>
          <TabsContent value="configuracoes" className="space-y-4">
            <ConfiguracoesPosVendasTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
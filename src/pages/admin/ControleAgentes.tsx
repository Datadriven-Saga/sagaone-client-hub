import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { ControleAgentesContent } from "@/components/admin/ControleAgentesContent";
import { CadenciaLigacaoConfig } from "@/components/CadenciaLigacaoConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ControleAgentes() {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Controle de Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie implantações e status de agentes por loja
            </p>
          </div>
          <Tabs defaultValue="agentes" className="min-w-0">
            <TabsList>
              <TabsTrigger value="agentes">Agentes</TabsTrigger>
              <TabsTrigger value="cadencia-ligacao">Cadência Ligação</TabsTrigger>
            </TabsList>
            <TabsContent value="agentes">
              <ControleAgentesContent />
            </TabsContent>
            <TabsContent value="cadencia-ligacao">
              <CadenciaLigacaoConfig />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
}

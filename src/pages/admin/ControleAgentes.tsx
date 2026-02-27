import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { ControleAgentesContent } from "@/components/admin/ControleAgentesContent";
import { CadenciaLigacaoConfig } from "@/components/CadenciaLigacaoConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Bot } from "lucide-react";

export default function ControleAgentes() {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Controle de Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie implantações e configurações de agentes
            </p>
          </div>
          <Tabs defaultValue="agentes" className="min-w-0">
            <TabsList className="flex-nowrap overflow-x-auto">
              <TabsTrigger value="agentes" className="min-w-max whitespace-nowrap gap-1.5">
                <Bot className="h-4 w-4" />
                Agentes
              </TabsTrigger>
              <TabsTrigger value="cadencia-ligacao" className="min-w-max whitespace-nowrap gap-1.5">
                <Phone className="h-4 w-4" />
                Ligação
              </TabsTrigger>
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

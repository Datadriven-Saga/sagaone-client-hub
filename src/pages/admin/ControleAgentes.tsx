import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { ControleAgentesContent } from "@/components/admin/ControleAgentesContent";
import { CadenciaLigacaoConfig } from "@/components/CadenciaLigacaoConfig";
import { EnvioMensagemConfig } from "@/components/EnvioMensagemConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ControleAgentes() {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Controle de Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie implantações, cadências e disparos de mensagens
            </p>
          </div>
          <Tabs defaultValue="agentes" className="min-w-0">
            <TabsList className="flex-nowrap overflow-x-auto">
              <TabsTrigger value="agentes" className="min-w-max whitespace-nowrap">Agentes</TabsTrigger>
              <TabsTrigger value="cadencia-ligacao" className="min-w-max whitespace-nowrap">Configuração Ligação</TabsTrigger>
              <TabsTrigger value="envio-mensagem" className="min-w-max whitespace-nowrap">Envio de Mensagem</TabsTrigger>
            </TabsList>
            <TabsContent value="agentes">
              <ControleAgentesContent />
            </TabsContent>
            <TabsContent value="cadencia-ligacao">
              <CadenciaLigacaoConfig />
            </TabsContent>
            <TabsContent value="envio-mensagem">
              <EnvioMensagemConfig />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
}

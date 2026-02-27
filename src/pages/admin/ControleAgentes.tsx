import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { ControleAgentesContent } from "@/components/admin/ControleAgentesContent";
import { CadenciaLigacaoConfig } from "@/components/CadenciaLigacaoConfig";
import { EnvioMensagemConfig } from "@/components/EnvioMensagemConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Bot } from "lucide-react";

export default function ControleAgentes() {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Controle de Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie implantações, cadências de ligação e disparos de mensagens
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
                Configuração Ligação
              </TabsTrigger>
              <TabsTrigger value="envio-mensagem" className="min-w-max whitespace-nowrap gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Envio de Mensagem
              </TabsTrigger>
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

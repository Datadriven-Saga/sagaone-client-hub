import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Phone, Cpu } from "lucide-react";
import GastosGeraisTab from "@/components/admin/GastosGeraisTab";
import VapiMetricsTab from "@/components/admin/VapiMetricsTab";
import TwilioCostsTab from "@/components/admin/TwilioCostsTab";

const ControleGastosLigacao = () => {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Controle de Gastos — Ligação</h1>
            <p className="text-muted-foreground">Dashboard de custos e métricas de chamadas de voz</p>
          </div>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="geral" className="gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gastos Gerais</span>
                <span className="sm:hidden">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="vapi" className="gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Custos Vapi</span>
                <span className="sm:hidden">Vapi</span>
              </TabsTrigger>
              <TabsTrigger value="twilio" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Custos Twilio</span>
                <span className="sm:hidden">Twilio</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" forceMount className="data-[state=inactive]:hidden">
              <GastosGeraisTab />
            </TabsContent>

            <TabsContent value="vapi" forceMount className="data-[state=inactive]:hidden">
              <VapiMetricsTab />
            </TabsContent>

            <TabsContent value="twilio" forceMount className="data-[state=inactive]:hidden">
              <TwilioCostsTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleGastosLigacao;

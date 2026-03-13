import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CriarCaixaCWTab } from "@/components/integracoes/CriarCaixaCWTab";

const Integracoes = () => {
  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Criar Integração
            </h1>
            <p className="text-muted-foreground">
              Configure e gerencie integrações externas do sistema
            </p>
          </div>

          <Tabs defaultValue="criar-caixa-cw" className="w-full">
            <TabsList>
              <TabsTrigger value="criar-caixa-cw">Criar Caixa CW</TabsTrigger>
            </TabsList>

            <TabsContent value="criar-caixa-cw">
              <CriarCaixaCWTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Integracoes;

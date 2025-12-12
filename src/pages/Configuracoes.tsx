import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProdutosTab } from "@/components/ProdutosTab";
import { MotivosTab } from "@/components/configuracoes/MotivosTab";
import { DepartamentosTab } from "@/components/configuracoes/DepartamentosTab";
import { MensagensTab } from "@/components/configuracoes/MensagensTab";
import { TemperaturasTab } from "@/components/configuracoes/TemperaturasTab";
import { DocumentosTab } from "@/components/configuracoes/DocumentosTab";

const Configuracoes = () => {
  return (
    <DashboardLayout title="Configurações">
      <Tabs defaultValue="produtos" className="space-y-3">
        <TabsList className="justify-start w-auto inline-flex">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="motivos">Motivos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="temperatura">Temperatura</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-6">
          <ProdutosTab />
        </TabsContent>

        <TabsContent value="motivos" className="space-y-6">
          <MotivosTab />
        </TabsContent>

        <TabsContent value="departamentos" className="space-y-6">
          <DepartamentosTab />
        </TabsContent>

        <TabsContent value="mensagens" className="space-y-6">
          <MensagensTab />
        </TabsContent>

        <TabsContent value="temperatura" className="space-y-6">
          <TemperaturasTab />
        </TabsContent>

        <TabsContent value="documentos" className="space-y-6">
          <DocumentosTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Configuracoes;

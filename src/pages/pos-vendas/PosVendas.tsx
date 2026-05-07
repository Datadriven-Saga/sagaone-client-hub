import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntregasTab } from "@/components/pos-vendas/EntregasTab";
import { AgendamentosTab } from "@/components/pos-vendas/AgendamentosTab";
import { LojasTab } from "@/components/pos-vendas/LojasTab";
import TemplatesPaty from "@/pages/pos-vendas/TemplatesPaty";

const VALID = ["entregas", "agendamentos", "lojas", "templates"] as const;
type TabKey = typeof VALID[number];

export default function PosVendas() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const initial: TabKey = (VALID as readonly string[]).includes(tab ?? "") ? (tab as TabKey) : "entregas";
  const [active, setActive] = useState<TabKey>(initial);

  useEffect(() => {
    if (tab && (VALID as readonly string[]).includes(tab) && tab !== active) setActive(tab as TabKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleChange = (v: string) => {
    setActive(v as TabKey);
    navigate(`/pos-vendas/${v}`, { replace: true });
  };

  return (
    <DashboardLayout title="Pós-Vendas">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Pós-Vendas</h1>
          <p className="text-sm text-muted-foreground">Configuração da agente Paty: gatilhos, cadências, lojas e templates.</p>
        </div>
        <Tabs value={active} onValueChange={handleChange}>
          <TabsList>
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            <TabsTrigger value="lojas">Lojas</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="entregas"><EntregasTab /></TabsContent>
          <TabsContent value="agendamentos"><AgendamentosTab /></TabsContent>
          <TabsContent value="lojas"><LojasTab /></TabsContent>
          <TabsContent value="templates"><TemplatesPaty /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

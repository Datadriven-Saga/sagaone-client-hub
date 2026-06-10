import { DashboardLayout } from "@/components/DashboardLayout";
import { EntregasTab } from "@/components/pos-vendas/EntregasTab";

export default function EntregasGatilhos() {
  return (
    <DashboardLayout title="Entregas — Gatilhos Saga Conecta">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Entregas — Gatilhos Saga Conecta</h1>
          <p className="text-sm text-muted-foreground">Configuração dos gatilhos de templates da Paty para Entregas.</p>
        </div>
        <EntregasTab />
      </div>
    </DashboardLayout>
  );
}
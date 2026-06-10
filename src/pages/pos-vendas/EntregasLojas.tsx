import { DashboardLayout } from "@/components/DashboardLayout";
import { LojasTab } from "@/components/pos-vendas/LojasTab";

export default function EntregasLojas() {
  return (
    <DashboardLayout title="Entregas — Lojas Saga Conecta">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Entregas — Lojas Saga Conecta</h1>
          <p className="text-sm text-muted-foreground">Configuração de lojas Saga Conecta para Entregas.</p>
        </div>
        <LojasTab />
      </div>
    </DashboardLayout>
  );
}
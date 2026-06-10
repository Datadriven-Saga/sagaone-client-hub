import { DashboardLayout } from "@/components/DashboardLayout";
import { PecasLojasSection } from "@/components/pos-vendas/PecasLojasSection";

export default function PecasLojas() {
  return (
    <DashboardLayout title="Peças — Lojas">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Peças — Lojas</h1>
          <p className="text-sm text-muted-foreground">Configuração de lojas (prazos, agente, endereço) para Peças.</p>
        </div>
        <PecasLojasSection />
      </div>
    </DashboardLayout>
  );
}
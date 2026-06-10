import { DashboardLayout } from "@/components/DashboardLayout";
import { PecasTemplatesSection } from "@/components/pos-vendas/PecasTemplatesSection";

export default function PecasGatilhos() {
  return (
    <DashboardLayout title="Peças — Gatilhos">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Peças — Gatilhos</h1>
          <p className="text-sm text-muted-foreground">Configuração dos gatilhos de templates da Paty para Peças.</p>
        </div>
        <PecasTemplatesSection />
      </div>
    </DashboardLayout>
  );
}
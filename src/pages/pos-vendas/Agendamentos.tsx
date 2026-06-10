import { DashboardLayout } from "@/components/DashboardLayout";
import { AgendamentosTab } from "@/components/pos-vendas/AgendamentosTab";

export default function Agendamentos() {
  return (
    <DashboardLayout title="Agendamentos">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Configuração de agendamentos da Paty.</p>
        </div>
        <AgendamentosTab />
      </div>
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/DashboardLayout";
import { CadenciaConversacionalTab } from "@/components/pos-vendas/CadenciaConversacionalTab";

export default function PatyCadencia() {
  return (
    <DashboardLayout title="Paty Geral — Cadência Conversacional">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Cadência Conversacional</h1>
          <p className="text-sm text-muted-foreground">Configuração da cadência conversacional da Paty.</p>
        </div>
        <CadenciaConversacionalTab />
      </div>
    </DashboardLayout>
  );
}
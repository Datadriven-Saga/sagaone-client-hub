import { DashboardLayout } from "@/components/DashboardLayout";
import TemplatesPaty from "@/pages/pos-vendas/TemplatesPaty";

export default function PatyTemplates() {
  return (
    <DashboardLayout title="Paty Geral — Templates">
      <div className="container mx-auto py-6 space-y-4">
        <TemplatesPaty />
      </div>
    </DashboardLayout>
  );
}
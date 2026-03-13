import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Plug } from "lucide-react";

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

          <div className="bg-card border rounded-lg p-8 text-center">
            <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Em breve</h3>
            <p className="text-sm text-muted-foreground">
              O módulo de integrações está sendo desenvolvido. Em breve você poderá configurar conexões com sistemas externos diretamente por aqui.
            </p>
          </div>
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Integracoes;

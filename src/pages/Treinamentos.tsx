import { useState } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { SimulacoesUnificadas } from "@/components/academy/SimulacoesUnificadas";
import { VoiceSimulation } from "@/components/academy/VoiceSimulation";
import { SimulationHistory } from "@/components/academy/SimulationHistory";
import { SimulationDetails } from "@/components/academy/SimulationDetails";
import { SimulationFeedbackModal } from "@/components/academy/SimulationFeedbackModal";
import { AcademyAdminPanel } from "@/components/academy/AcademyAdminPanel";
import { TrainingScenario, Persona } from "@/types/academy";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TreinamentosProps {
  adminMode?: boolean;
}

const Treinamentos = ({ adminMode = false }: TreinamentosProps) => {
  const location = useLocation();
  const { isAdminOrTI, loading: accessLoading } = useUserAccessType();
  const [activeSimulation, setActiveSimulation] = useState<{
    scenario: TrainingScenario;
    persona: Persona;
  } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleStartSimulation = (scenario: TrainingScenario, persona: Persona) => {
    setActiveSimulation({ scenario, persona });
  };

  const handleEndSimulation = () => {
    setActiveSimulation(null);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = (rating: number, comment: string) => {
    console.log("Feedback submitted:", { rating, comment });
    setShowFeedbackModal(false);
  };

  // If admin mode, render admin panel directly
  if (adminMode) {
    return (
      <DashboardLayout>
        <AcademyAdminPanel />
      </DashboardLayout>
    );
  }

  // Show "Em desenvolvimento" for non-admin/TI users
  if (!accessLoading && !isAdminOrTI) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 max-w-md text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Construction className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Em Desenvolvimento</h2>
            <p className="text-muted-foreground">
              O módulo de Treinamentos está sendo desenvolvido e estará disponível em breve.
            </p>
            <p className="text-sm text-muted-foreground">
              Aguarde novidades!
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // If there's an active simulation, render it full screen within DashboardLayout
  if (activeSimulation) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)]">
          <VoiceSimulation
            scenario={activeSimulation.scenario}
            persona={activeSimulation.persona}
            onEnd={handleEndSimulation}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Determine what content to render based on pathname
  const renderContent = () => {
    const path = location.pathname;

    if (path === "/treinamentos") {
      return <AcademyDashboard />;
    }
    // All simulation routes now use the unified component
    if (path === "/treinamentos/simulacoes" || 
        path === "/treinamentos/simulacoes-voz" || 
        path === "/treinamentos/simulacoes-texto" ||
        path === "/treinamentos/trilhas") {
      return (
        <SimulacoesUnificadas onStartSimulation={handleStartSimulation} />
      );
    }
    if (path === "/treinamentos/historico") {
      return <SimulationHistory />;
    }
    if (path.startsWith("/treinamentos/historico/")) {
      return <SimulationDetails />;
    }

    return <AcademyDashboard />;
  };

  return (
    <DashboardLayout>
      {renderContent()}
      
      <SimulationFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </DashboardLayout>
  );
};

export default Treinamentos;
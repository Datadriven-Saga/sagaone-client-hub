import { useState } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { LearningPaths } from "@/components/academy/LearningPaths";
import { SimulationSelector } from "@/components/academy/SimulationSelector";
import { VoiceSimulation } from "@/components/academy/VoiceSimulation";
import { SimulationHistory } from "@/components/academy/SimulationHistory";
import { SimulationDetails } from "@/components/academy/SimulationDetails";
import { SimulationFeedbackModal } from "@/components/academy/SimulationFeedbackModal";
import { AcademyAdminPanel } from "@/components/academy/AcademyAdminPanel";
import { TrainingScenario, Persona } from "@/types/academy";

interface TreinamentosProps {
  adminMode?: boolean;
}

const Treinamentos = ({ adminMode = false }: TreinamentosProps) => {
  const location = useLocation();
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
    if (path === "/treinamentos/simulacoes") {
      return <LearningPaths />;
    }
    if (path === "/treinamentos/simulacoes-voz") {
      return (
        <SimulationSelector
          type="voice"
          onStartSimulation={handleStartSimulation}
        />
      );
    }
    if (path === "/treinamentos/simulacoes-texto") {
      return (
        <SimulationSelector
          type="text"
          onStartSimulation={handleStartSimulation}
        />
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
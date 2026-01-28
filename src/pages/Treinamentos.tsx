import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AcademyLayout } from "@/components/academy/AcademyLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { AcademyRanking } from "@/components/academy/AcademyRanking";
import { LearningPaths } from "@/components/academy/LearningPaths";
import { SimulationSelector } from "@/components/academy/SimulationSelector";
import { VoiceSimulation } from "@/components/academy/VoiceSimulation";
import { SimulationHistory } from "@/components/academy/SimulationHistory";
import { SimulationDetails } from "@/components/academy/SimulationDetails";
import { SimulationFeedbackModal } from "@/components/academy/SimulationFeedbackModal";
import { TrainingScenario, Persona } from "@/types/academy";

const Treinamentos = () => {
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

  // If there's an active simulation, render it full screen
  if (activeSimulation) {
    return (
      <AcademyLayout>
        <VoiceSimulation
          scenario={activeSimulation.scenario}
          persona={activeSimulation.persona}
          onEnd={handleEndSimulation}
        />
      </AcademyLayout>
    );
  }

  // Determine what content to render based on pathname
  const renderContent = () => {
    const path = location.pathname;

    if (path === "/treinamentos") {
      return <AcademyDashboard />;
    }
    if (path === "/treinamentos/ranking") {
      return <AcademyRanking />;
    }
    if (path === "/treinamentos/trilhas") {
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
    if (path === "/treinamentos/admin") {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Painel Admin</h1>
          <p className="text-muted-foreground">
            Configurações administrativas em breve...
          </p>
        </div>
      );
    }

    return <AcademyDashboard />;
  };

  return (
    <AcademyLayout>
      {renderContent()}
      
      <SimulationFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </AcademyLayout>
  );
};

export default Treinamentos;

import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { SimulacoesUnificadas } from "@/components/academy/SimulacoesUnificadas";
import { VoiceSimulation } from "@/components/academy/VoiceSimulation";
import { SimulationHistory } from "@/components/academy/SimulationHistory";
import { SimulationDetails } from "@/components/academy/SimulationDetails";
import { SimulationFeedbackModal } from "@/components/academy/SimulationFeedbackModal";
import { AcademyAdminPanel } from "@/components/academy/AcademyAdminPanel";
import { TrainingScenario, Persona, SimulationMessage } from "@/types/academy";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useStartSessao, useEndSessao } from "@/hooks/useAcademyData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface TreinamentosProps {
  adminMode?: boolean;
}

const Treinamentos = ({ adminMode = false }: TreinamentosProps) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdminOrTI, loading: accessLoading } = useUserAccessType();
  const [activeSimulation, setActiveSimulation] = useState<{
    scenario: TrainingScenario;
    persona: Persona;
  } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  // Track current session
  const currentSessionRef = useRef<{
    id: string;
    simulacaoId: string;
    messages: SimulationMessage[];
    duration: number;
    startTime: number;
  } | null>(null);

  const startSessaoMutation = useStartSessao();
  const endSessaoMutation = useEndSessao();

  const handleStartSimulation = async (scenario: TrainingScenario, persona: Persona) => {
    try {
      // Find the simulacao_id from the scenario
      const simulacaoId = scenario.id;
      
      // Create session in database
      const sessao = await startSessaoMutation.mutateAsync(simulacaoId);
      
      // Store session reference
      currentSessionRef.current = {
        id: sessao.id,
        simulacaoId,
        messages: [],
        duration: 0,
        startTime: Date.now(),
      };
      
      setActiveSimulation({ scenario, persona });
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Erro ao iniciar sessão. Tente novamente.");
    }
  };

  const handleSessionEnd = (messages: SimulationMessage[], duration: number) => {
    // Update session ref with final data
    if (currentSessionRef.current) {
      currentSessionRef.current.messages = messages;
      currentSessionRef.current.duration = duration;
    }
  };

  const handleEndSimulation = () => {
    setActiveSimulation(null);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    const session = currentSessionRef.current;
    
    if (!session) {
      console.error("No active session to save");
      setShowFeedbackModal(false);
      return;
    }

    try {
      // Calculate duration
      const finalDuration = session.duration || Math.floor((Date.now() - session.startTime) / 1000);
      
      // Format transcription
      const transcricao = session.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      // End session in database with evaluation data
      await endSessaoMutation.mutateAsync({
        sessaoId: session.id,
        transcricao,
        avaliacoes: {
          user_rating: rating,
          user_comment: comment,
        },
        notaFinal: rating * 2, // Convert 1-5 to 2-10 scale
        feedbackIA: `Avaliação do usuário: ${rating}/5 estrelas. ${comment || "Sem comentário adicional."}`,
        pontosFortes: [],
        pontosMelhoria: [],
      });

      // Update session duration in database
      await supabase
        .from("academy_sessoes_simulacao")
        .update({ duracao_segundos: finalDuration })
        .eq("id", session.id);

      // Recalculate user metrics
      if (user?.id) {
        await supabase.rpc("academy_recalcular_metricas_usuario", {
          p_user_id: user.id,
        });
      }

      // Invalidate all related queries to refresh data across all screens
      await queryClient.invalidateQueries({ queryKey: ["academy-sessoes"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-all-sessoes"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-ranking"] });

      toast.success("Sessão salva com sucesso!");
      
      // Clear session reference
      currentSessionRef.current = null;
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Erro ao salvar sessão. Seus dados foram perdidos.");
    }

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
            onSessionData={handleSessionEnd}
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
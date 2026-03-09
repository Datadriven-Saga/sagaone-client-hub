import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { SimulacoesUnificadas } from "@/components/academy/SimulacoesUnificadas";
import { VoiceSimulation } from "@/components/academy/VoiceSimulation";
import { TextSimulation } from "@/components/academy/TextSimulation";
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
  const { permissions, loading: accessLoading } = useUserAccessType();
  const isAdminOrTI = permissions.canManageAcademy ?? false;
  const [activeSimulation, setActiveSimulation] = useState<{
    scenario: TrainingScenario;
    persona: Persona;
  } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  
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

  const handleStartSimulation = async (scenario: TrainingScenario, persona: Persona, testMode: boolean = false) => {
    // If test mode, skip session creation entirely
    if (testMode) {
      setIsTestMode(true);
      currentSessionRef.current = null;
      setActiveSimulation({ scenario, persona });
      return;
    }
    
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
      
      setIsTestMode(false);
      setActiveSimulation({ scenario, persona });
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Erro ao iniciar sessão. Tente novamente.");
    }
  };

  const handleSessionEnd = (messages: SimulationMessage[], duration: number) => {
    // Update session ref with final data (skip in test mode)
    if (currentSessionRef.current && !isTestMode) {
      currentSessionRef.current.messages = messages;
      currentSessionRef.current.duration = duration;
    }
  };

  const handleEndSimulation = () => {
    setActiveSimulation(null);
    
    // In test mode, skip feedback modal entirely
    if (isTestMode) {
      setIsTestMode(false);
      toast.success("Teste finalizado! (sem registro)");
      return;
    }
    
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

      // Calculate nota final (1-5 rating → 2-10 scale)
      const notaFinal = rating * 2;

      // Best-effort: keep academy_progresso in sync for simulations so the Dashboard tabs
      // “Métricas de uso” and “Tabela de análises” update consistently.
      const syncProgressoFromSimulacao = async (simulacaoId: string, duracaoSegundos: number, nota: number) => {
        if (!user?.id) return;

        // 1) Resolve treinamento_id for this simulacao
        let treinamentoId: string | null = null;

        const { data: simRow, error: simErr } = await supabase
          .from("academy_simulacoes")
          .select("treinamento_id")
          .eq("id", simulacaoId)
          .maybeSingle();

        if (simErr) {
          console.warn("[Treinamentos] Falha ao buscar treinamento_id da simulação:", simErr);
        }

        if (simRow?.treinamento_id) {
          treinamentoId = simRow.treinamento_id;
        } else {
          const { data: tRow, error: tErr } = await supabase
            .from("academy_treinamentos")
            .select("id")
            // JSON filter: conteudo.simulacao_id
            .eq("conteudo->>simulacao_id", simulacaoId)
            .limit(1)
            .maybeSingle();

          if (tErr) {
            console.warn("[Treinamentos] Falha ao buscar treinamento via conteudo.simulacao_id:", tErr);
          }

          if (tRow?.id) treinamentoId = tRow.id;
        }

        if (!treinamentoId) return;

        const minutosGastos = Math.max(0, Math.ceil((duracaoSegundos || 0) / 60));

        // 2) Update existing (training-level) progress row if present (modulo_id IS NULL)
        const { data: existing, error: existingErr } = await supabase
          .from("academy_progresso")
          .select("id, tentativas, tempo_gasto_minutos, data_inicio")
          .eq("user_id", user.id)
          .eq("treinamento_id", treinamentoId)
          .is("modulo_id", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingErr) {
          console.warn("[Treinamentos] Falha ao buscar progresso existente:", existingErr);
        }

        const now = new Date().toISOString();
        const nextTentativas = (existing?.tentativas ?? 0) + 1;
        const nextTempo = (existing?.tempo_gasto_minutos ?? 0) + minutosGastos;
        const dataInicio = existing?.data_inicio ?? now;

        if (existing?.id) {
          const { error: updErr } = await supabase
            .from("academy_progresso")
            .update({
              status: "concluido",
              percentual_concluido: 100,
              nota,
              tentativas: nextTentativas,
              tempo_gasto_minutos: nextTempo,
              data_inicio: dataInicio,
              data_conclusao: now,
            })
            .eq("id", existing.id);

          if (updErr) {
            console.warn("[Treinamentos] Falha ao atualizar academy_progresso:", updErr);
          }
        } else {
          const { error: insErr } = await supabase
            .from("academy_progresso")
            .insert({
              user_id: user.id,
              treinamento_id: treinamentoId,
              modulo_id: null,
              status: "concluido",
              percentual_concluido: 100,
              nota,
              tentativas: 1,
              tempo_gasto_minutos: minutosGastos,
              data_inicio: now,
              data_conclusao: now,
            });

          if (insErr) {
            console.warn("[Treinamentos] Falha ao inserir academy_progresso:", insErr);
          }
        }
      };

      // Build avaliacoes with dimension notes for the metrics calculation
      // The DB function expects format: { "Situação": { "nota": X }, ... }
      // For now, distribute the rating across all dimensions until we have AI evaluation
      const avaliacoes = {
        user_rating: rating,
        user_comment: comment,
        // Add dimension scores (same as final score until AI provides detailed evaluation)
        "Situação": { nota: notaFinal },
        "Problema": { nota: notaFinal },
        "Implicação": { nota: notaFinal },
        "Negociação e Objeção": { nota: notaFinal },
        "Fechamento e Próximos Passos": { nota: notaFinal },
      };

      // End session in database with evaluation data
      await endSessaoMutation.mutateAsync({
        sessaoId: session.id,
        transcricao,
        avaliacoes,
        notaFinal,
        feedbackIA: `Avaliação do usuário: ${rating}/5 estrelas. ${comment || "Sem comentário adicional."}`,
        pontosFortes: [],
        pontosMelhoria: [],
        duracaoSegundos: finalDuration,
      });

      // Update progress for the training linked to this simulation (best-effort)
      await syncProgressoFromSimulacao(session.simulacaoId, finalDuration, notaFinal);

      // Recalculate user metrics
      if (user?.id) {
        const { error: metricsError } = await supabase.rpc("academy_recalcular_metricas_usuario", {
          p_user_id: user.id,
        });

        if (metricsError) throw metricsError;
      }

      // Invalidate all related queries to refresh data across all screens
      await queryClient.invalidateQueries({ queryKey: ["academy-sessoes"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-all-sessoes"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-ranking"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-progresso"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-recomendacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["academy-sessao-details"] });

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
    const isVoiceSimulation = activeSimulation.scenario.type === "voice";
    
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)]">
          {isVoiceSimulation ? (
            <VoiceSimulation
              scenario={activeSimulation.scenario}
              persona={activeSimulation.persona}
              onEnd={handleEndSimulation}
              onSessionData={handleSessionEnd}
            />
          ) : (
            <TextSimulation
              scenario={activeSimulation.scenario}
              persona={activeSimulation.persona}
              onEnd={handleEndSimulation}
              onSessionData={handleSessionEnd}
            />
          )}
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
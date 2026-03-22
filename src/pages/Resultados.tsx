import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { 
  Package, 
  User, 
  Trophy, 
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { ResultadosGlobalFilter } from "@/components/resultados/ResultadosGlobalFilter";
import { 
  ResultadosLigacaoSkeleton, 
  ResultadosResumoSkeleton, 
  ResultadosGenericSkeleton 
} from "@/components/resultados/ResultadosSkeleton";

// Lazy-loaded tab components
const ResumoTab = lazy(() => 
  import("@/components/resultados/ResumoTab").then(m => ({ default: m.ResumoTab }))
);
const DesempenhoTab = lazy(() => 
  import("@/components/resultados/DesempenhoTab").then(m => ({ default: m.DesempenhoTab }))
);
const RankingTab = lazy(() => 
  import("@/components/resultados/RankingTab").then(m => ({ default: m.RankingTab }))
);
const MetricasLigacaoTab = lazy(() => 
  import("@/components/resultados/MetricasLigacaoTab").then(m => ({ default: m.MetricasLigacaoTab }))
);
const EventoSelectorLigacao = lazy(() => 
  import("@/components/resultados/EventoSelectorLigacao").then(m => ({ default: m.EventoSelectorLigacao }))
);
const DashboardWhatsAppTab = lazy(() => 
  import("@/components/resultados/DashboardWhatsAppTab").then(m => ({ default: m.DashboardWhatsAppTab }))
);
const EventoSelectorWhatsApp = lazy(() => 
  import("@/components/resultados/EventoSelectorWhatsApp").then(m => ({ default: m.EventoSelectorWhatsApp }))
);
const AdminDashboardWhatsApp = lazy(() => 
  import("@/components/resultados/AdminDashboardWhatsApp").then(m => ({ default: m.AdminDashboardWhatsApp }))
);
const AdminDashboardLigacao = lazy(() => 
  import("@/components/resultados/AdminDashboardLigacao").then(m => ({ default: m.AdminDashboardLigacao }))
);

interface Prospeccao {
  id: string;
  titulo: string;
  data_inicio: string | null;
  data_fim: string | null;
}

// Map route segments to tab keys
const routeToTab: Record<string, string> = {
  "": "resumo",
  "whatsapp": "dashboard-whatsapp",
  "ligacao": "ligacao",
  "ranking": "ranking",
  "produtos": "produtos",
  "desempenho": "desempenho",
  "individual": "individual",
  "premiacoes": "premiacoes",
  "relatorios": "relatorios",
};

// Map route to page titles
const routeToTitle: Record<string, string> = {
  "": "Performance · Resumo",
  "whatsapp": "Performance · WhatsApp",
  "ligacao": "Performance · Ligação",
  "ranking": "Performance · Ranking",
  "produtos": "Performance · Produtos",
  "desempenho": "Performance · Desempenho",
  "individual": "Performance · Individual",
  "premiacoes": "Performance · Premiações",
  "relatorios": "Performance · Relatórios",
};

const Resultados = () => {
  const location = useLocation();
  
  // Derive active tab from URL
  const pathSegment = location.pathname.replace("/resultados", "").replace(/^\//, "");
  const activeTab = routeToTab[pathSegment] || "resumo";
  const pageTitle = routeToTitle[pathSegment] || "Performance";

  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [selectedProspeccoes, setSelectedProspeccoes] = useState<string[]>([]);
  const { activeCompany } = useCompany();
  
  // Check if active company is EMPRESA ADMIN
  const isEmpresaAdmin = activeCompany?.nome_empresa === "EMPRESA ADMIN";
  
  // State for Ligação tab
  const [selectedAgentPhone, setSelectedAgentPhone] = useState<string | null>(null);
  const [selectedLigacaoEventId, setSelectedLigacaoEventId] = useState<string | null>(null);
  
  // State for WhatsApp tab
  const [selectedWhatsAppEventId, setSelectedWhatsAppEventId] = useState<string | null>(null);
  const [selectedWhatsAppEventIdPri, setSelectedWhatsAppEventIdPri] = useState<string | null>(null);

  // Buscar prospecções da empresa
  useEffect(() => {
    const fetchProspeccoes = async () => {
      if (!activeCompany?.id) return;

      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, data_inicio, data_fim')
        .eq('empresa_id', activeCompany.id)
        .order('data_inicio', { ascending: false });

      if (!error && data) {
        setProspeccoes(data);
        if (data.length > 0 && selectedProspeccoes.length === 0) {
          setSelectedProspeccoes([data[0].id]);
        }
      }
    };

    fetchProspeccoes();
  }, [activeCompany?.id]);

  const handleWhatsAppEventSelect = useCallback((eventId: string, eventIdPri: string) => {
    setSelectedWhatsAppEventId(eventId);
    setSelectedWhatsAppEventIdPri(eventIdPri);
  }, []);

  const handleLigacaoEventSelect = useCallback((eventId: string, phone: string) => {
    setSelectedLigacaoEventId(eventId);
    setSelectedAgentPhone(phone);
  }, []);

  const handleWhatsAppEventChange = useCallback((eventId: string, eventIdPri: string) => {
    setSelectedWhatsAppEventId(eventId);
    setSelectedWhatsAppEventIdPri(eventIdPri);
  }, []);

  // Check if current tab needs global filter
  const showGlobalFilter = !["ligacao", "dashboard-whatsapp"].includes(activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case "resumo":
        return (
          <Suspense fallback={<ResultadosResumoSkeleton />}>
            <ResumoTab 
              prospeccaoIds={selectedProspeccoes} 
              empresaId={activeCompany?.id || null}
            />
          </Suspense>
        );

      case "dashboard-whatsapp":
        // EMPRESA ADMIN gets the admin aggregated view
        if (isEmpresaAdmin) {
          return (
            <Suspense fallback={<ResultadosGenericSkeleton />}>
              <AdminDashboardWhatsApp />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<ResultadosGenericSkeleton />}>
            {selectedWhatsAppEventId && selectedWhatsAppEventIdPri ? (
              <DashboardWhatsAppTab 
                selectedEventId={selectedWhatsAppEventId}
                selectedEventIdPri={selectedWhatsAppEventIdPri}
                onEventChange={handleWhatsAppEventChange}
              />
            ) : (
              <EventoSelectorWhatsApp
                onEventSelect={handleWhatsAppEventSelect}
                selectedEventId={selectedWhatsAppEventId}
              />
            )}
          </Suspense>
        );

      case "ligacao":
        return (
          <Suspense fallback={<ResultadosLigacaoSkeleton />}>
            {selectedAgentPhone ? (
              <MetricasLigacaoTab 
                selectedAgentPhone={selectedAgentPhone}
                initialEventId={selectedLigacaoEventId}
              />
            ) : (
              <EventoSelectorLigacao
                onEventSelect={handleLigacaoEventSelect}
                selectedEventId={null}
                agentPhone={null}
              />
            )}
          </Suspense>
        );

      case "ranking":
        return (
          <Suspense fallback={<ResultadosGenericSkeleton />}>
            <RankingTab 
              prospeccaoId={selectedProspeccoes[0] || null} 
              empresaId={activeCompany?.id || null} 
            />
          </Suspense>
        );

      case "produtos":
        return (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Produtos</h3>
            <p className="text-sm text-muted-foreground">Análise de produtos vendidos</p>
          </Card>
        );

      case "desempenho":
        return (
          <Suspense fallback={<ResultadosGenericSkeleton />}>
            <DesempenhoTab 
              prospeccaoId={selectedProspeccoes[0] || null} 
              empresaId={activeCompany?.id || null} 
            />
          </Suspense>
        );

      case "individual":
        return (
          <Card className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Resultados Individuais</h3>
            <p className="text-sm text-muted-foreground">Desempenho individual de cada membro da equipe</p>
          </Card>
        );

      case "premiacoes":
        return (
          <Card className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Premiações</h3>
            <p className="text-sm text-muted-foreground">Ranking e premiações do evento</p>
          </Card>
        );

      case "relatorios":
        return (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Relatórios</h3>
            <p className="text-sm text-muted-foreground">Geração e exportação de relatórios</p>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout title={pageTitle}>
      <div className="flex flex-col h-full w-full">
        {/* Filtro Global - only show for tabs that need it */}
        {showGlobalFilter && (
          <ResultadosGlobalFilter
            prospeccoes={prospeccoes}
            selectedProspeccoes={selectedProspeccoes}
            onSelectedProspeccoesChange={setSelectedProspeccoes}
            className="mb-4"
          />
        )}

        <ScrollIndicator className="flex-1 h-full">
          <div className="pb-6">
            {renderContent()}
          </div>
        </ScrollIndicator>
      </div>
    </DashboardLayout>
  );
};

export default Resultados;

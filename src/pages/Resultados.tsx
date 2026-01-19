import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { 
  LayoutDashboard, 
  Medal, 
  Package, 
  BarChart3, 
  User, 
  Trophy, 
  FileText,
  Phone,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { ResumoTab } from "@/components/resultados/ResumoTab";
import { DesempenhoTab } from "@/components/resultados/DesempenhoTab";
import { RankingTab } from "@/components/resultados/RankingTab";
import { ResultadosGlobalFilter } from "@/components/resultados/ResultadosGlobalFilter";
import { DashboardLigacaoTab } from "@/components/resultados/DashboardLigacaoTab";
import { MetricasLigacaoTab } from "@/components/resultados/MetricasLigacaoTab";
import { EventoSelectorLigacao } from "@/components/resultados/EventoSelectorLigacao";

interface Prospeccao {
  id: string;
  titulo: string;
  data_inicio: string | null;
  data_fim: string | null;
}

const Resultados = () => {
  const [activeTab, setActiveTab] = useState("resumo");
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [selectedProspeccoes, setSelectedProspeccoes] = useState<string[]>([]);
  const { activeCompany } = useCompany();
  
  // State for Ligação tabs
  const [selectedLigacaoEventId, setSelectedLigacaoEventId] = useState<string | null>(null);
  const [selectedAgentPhone, setSelectedAgentPhone] = useState<string | null>(null);

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

  const handleLigacaoEventSelect = (eventId: string, agentPhone: string) => {
    setSelectedLigacaoEventId(eventId);
    setSelectedAgentPhone(agentPhone);
    setActiveTab("dashboard-ligacao");
  };

  const handleDashboardEventChange = (eventId: string) => {
    setSelectedLigacaoEventId(eventId);
  };

  // Check if current tab needs global filter (not ligação tabs)
  const showGlobalFilter = !["dashboard-ligacao", "metricas-ligacao", "eventos-ligacao"].includes(activeTab);

  return (
    <DashboardLayout title="Resultados">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full w-full">
        <div className="bg-card border-b">
          <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0 gap-0">
            <TabsTrigger 
              value="resumo" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Resumo</span>
            </TabsTrigger>
            <TabsTrigger 
              value="dashboard-ligacao" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="metricas-ligacao" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Métricas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ranking" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <Medal className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Ranking</span>
            </TabsTrigger>
            <TabsTrigger 
              value="produtos" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Produtos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="desempenho" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Desempenho</span>
            </TabsTrigger>
            <TabsTrigger 
              value="individual" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Individual</span>
            </TabsTrigger>
            <TabsTrigger 
              value="premiacoes" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Premiações</span>
            </TabsTrigger>
            <TabsTrigger 
              value="relatorios" 
              className="relative h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Relatórios</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filtro Global - only show for non-ligação tabs */}
        {showGlobalFilter && (
          <ResultadosGlobalFilter
            prospeccoes={prospeccoes}
            selectedProspeccoes={selectedProspeccoes}
            onSelectedProspeccoesChange={setSelectedProspeccoes}
            className="mt-2"
          />
        )}

        {/* Tab Resumo */}
        <TabsContent value="resumo" className="flex-1 min-h-0 overflow-hidden mt-2">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <ResumoTab 
                prospeccaoIds={selectedProspeccoes} 
                empresaId={activeCompany?.id || null}
              />
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Dashboard Ligação */}
        <TabsContent value="dashboard-ligacao" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              {selectedLigacaoEventId && selectedAgentPhone ? (
                <DashboardLigacaoTab 
                  selectedEventId={selectedLigacaoEventId}
                  selectedAgentPhone={selectedAgentPhone}
                  onEventChange={handleDashboardEventChange}
                />
              ) : (
                <EventoSelectorLigacao
                  onEventSelect={handleLigacaoEventSelect}
                  selectedEventId={selectedLigacaoEventId}
                  agentPhone={selectedAgentPhone}
                />
              )}
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Métricas Ligação */}
        <TabsContent value="metricas-ligacao" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              {selectedAgentPhone ? (
                <MetricasLigacaoTab 
                  selectedAgentPhone={selectedAgentPhone}
                />
              ) : (
                <EventoSelectorLigacao
                  onEventSelect={(eventId, phone) => {
                    setSelectedAgentPhone(phone);
                    setActiveTab("metricas-ligacao");
                  }}
                  selectedEventId={null}
                  agentPhone={null}
                />
              )}
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Ranking */}
        <TabsContent value="ranking" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <RankingTab 
                prospeccaoId={selectedProspeccoes[0] || null} 
                empresaId={activeCompany?.id || null} 
              />
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Produtos */}
        <TabsContent value="produtos" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
                <h3 className="text-lg font-semibold mb-2">Produtos</h3>
                <p className="text-sm text-muted-foreground">
                  Análise de produtos vendidos
                </p>
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Desempenho */}
        <TabsContent value="desempenho" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <DesempenhoTab 
                prospeccaoId={selectedProspeccoes[0] || null} 
                empresaId={activeCompany?.id || null} 
              />
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Individual */}
        <TabsContent value="individual" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <Card className="p-8 text-center">
                <User className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
                <h3 className="text-lg font-semibold mb-2">Resultados Individuais</h3>
                <p className="text-sm text-muted-foreground">
                  Desempenho individual de cada membro da equipe
                </p>
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Premiações */}
        <TabsContent value="premiacoes" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <Card className="p-8 text-center">
                <Trophy className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
                <h3 className="text-lg font-semibold mb-2">Premiações</h3>
                <p className="text-sm text-muted-foreground">
                  Ranking e premiações do evento
                </p>
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>

        {/* Tab Relatórios */}
        <TabsContent value="relatorios" className="flex-1 min-h-0 overflow-hidden mt-4">
          <ScrollIndicator className="flex-1 h-full">
            <div className="pb-6">
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
                <h3 className="text-lg font-semibold mb-2">Relatórios</h3>
                <p className="text-sm text-muted-foreground">
                  Geração e exportação de relatórios
                </p>
              </Card>
            </div>
          </ScrollIndicator>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Resultados;

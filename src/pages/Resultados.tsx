import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  LayoutDashboard, 
  Medal, 
  Package, 
  BarChart3, 
  User, 
  Trophy, 
  FileText
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { ResumoTab } from "@/components/resultados/ResumoTab";
import { DesempenhoTab } from "@/components/resultados/DesempenhoTab";
import { RankingTab } from "@/components/resultados/RankingTab";

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

  const selectedProspeccaoData = prospeccoes.filter(p => selectedProspeccoes.includes(p.id));

  return (
    <DashboardLayout title="Resultados">
      <div className="space-y-2">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 h-auto p-1">
            <TabsTrigger value="resumo" className="flex items-center gap-1.5 text-xs py-2">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Resumo</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex items-center gap-1.5 text-xs py-2">
              <Medal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ranking</span>
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex items-center gap-1.5 text-xs py-2">
              <Package className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="desempenho" className="flex items-center gap-1.5 text-xs py-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desempenho</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-1.5 text-xs py-2">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Individual</span>
            </TabsTrigger>
            <TabsTrigger value="premiacoes" className="flex items-center gap-1.5 text-xs py-2">
              <Trophy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Premiações</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-1.5 text-xs py-2">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Resumo */}
          <TabsContent value="resumo" className="mt-2">
            <ResumoTab 
              prospeccaoIds={selectedProspeccoes} 
              empresaId={activeCompany?.id || null}
              prospeccoes={prospeccoes}
              selectedProspeccoes={selectedProspeccoes}
              onProspeccaoChange={setSelectedProspeccoes}
            />
          </TabsContent>

          {/* Tab Ranking */}
          <TabsContent value="ranking" className="mt-4">
            <RankingTab 
              prospeccaoId={selectedProspeccoes[0] || null} 
              empresaId={activeCompany?.id || null} 
            />
          </TabsContent>


          {/* Tab Produtos */}
          <TabsContent value="produtos" className="mt-4">
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Produtos</h3>
              <p className="text-sm text-muted-foreground">
                Análise de produtos vendidos
              </p>
            </Card>
          </TabsContent>

          {/* Tab Desempenho */}
          <TabsContent value="desempenho" className="mt-4">
            <DesempenhoTab 
              prospeccaoId={selectedProspeccoes[0] || null} 
              empresaId={activeCompany?.id || null} 
            />
          </TabsContent>

          {/* Tab Individual */}
          <TabsContent value="individual" className="mt-4">
            <Card className="p-8 text-center">
              <User className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Resultados Individuais</h3>
              <p className="text-sm text-muted-foreground">
                Desempenho individual de cada membro da equipe
              </p>
            </Card>
          </TabsContent>

          {/* Tab Premiações */}
          <TabsContent value="premiacoes" className="mt-4">
            <Card className="p-8 text-center">
              <Trophy className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Premiações</h3>
              <p className="text-sm text-muted-foreground">
                Ranking e premiações do evento
              </p>
            </Card>
          </TabsContent>

          {/* Tab Relatórios */}
          <TabsContent value="relatorios" className="mt-4">
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Relatórios</h3>
              <p className="text-sm text-muted-foreground">
                Geração e exportação de relatórios
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Resultados;

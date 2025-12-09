import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Target, Users, UserCheck, TrendingUp, UserPlus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
interface ResumoTabProps {
  prospeccaoIds?: string[];
  prospeccaoId?: string | null; // backward compatibility
  empresaId: string | null;
}

interface ProspeccaoMetas {
  meta_convites: number | null;
  meta_confirmacoes: number | null;
  meta_checkins: number | null;
  meta_novos: number | null;
  meta_seminovos: number | null;
  meta_diretas: number | null;
}

interface StatusCounts {
  totalBase: number;
  distribuidos: number;
  atribuidos: number;
  convidados: number;
  agendados: number;
  confirmados: number;
  checkins: number;
  vendas: number;
}

interface MetaCardProps {
  title: string;
  icon: React.ReactNode;
  realizado: number;
  meta: number;
  color: string;
}

const MetaCard = ({ title, icon, realizado, meta, color }: MetaCardProps) => {
  const percentage = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
  const progressValue = Math.min(percentage, 100);
  const exceededMeta = percentage > 100;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-2xl font-bold">{realizado}</span>
            <span className="text-muted-foreground text-sm ml-1">/ {meta}</span>
          </div>
          <span className={`text-lg font-bold ${exceededMeta ? 'text-green-600' : ''}`}>
            {percentage}%
          </span>
        </div>
        
        <div className="relative">
          <Progress 
            value={progressValue} 
            className="h-3"
          />
          {exceededMeta && (
            <div 
              className="absolute top-0 left-0 h-3 bg-green-500 rounded-full transition-all"
              style={{ width: '100%' }}
            />
          )}
        </div>
        
        {exceededMeta && (
          <p className="text-xs text-green-600 font-medium">
            Meta superada em {percentage - 100}%!
          </p>
        )}
      </div>
    </Card>
  );
};

interface FunnelStage {
  id: string;
  title: string;
  value: number;
  color: string;
}

interface SalesFunnelProps {
  stages: FunnelStage[];
}

const SalesFunnel = ({ stages }: SalesFunnelProps) => {
  const getConversionRate = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return 0;
    return Math.round((currentValue / previousValue) * 100);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-semibold text-sm">Funil de Vendas</h4>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[200px]">
              <p className="text-xs">Os percentuais à direita indicam a taxa de conversão em relação à etapa anterior.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-col items-center justify-center space-y-2 h-full">
        {stages.map((stage, index) => {
          const funnelWidths = [100, 85, 70, 55, 42, 30];
          const widthPercentage = funnelWidths[Math.min(index, funnelWidths.length - 1)];
          const previousStage = index > 0 ? stages[index - 1] : null;
          const conversionRate = previousStage ? getConversionRate(stage.value, previousStage.value) : 100;
          
          return (
            <div key={stage.id} className="w-full flex items-center justify-center gap-4">
              {/* Estágio do funil */}
              <div className="flex-1 flex justify-center">
                <div
                  className="relative flex items-center justify-center text-white font-semibold shadow-sm transition-all duration-300 hover:shadow-md"
                  style={{
                    backgroundColor: stage.color,
                    width: `${widthPercentage}%`,
                    height: '57px',
                    borderRadius: '8px'
                  }}
                >
                  <div className="text-center">
                    <div className="text-xl font-bold">{stage.value.toLocaleString()}</div>
                    <div className="text-xs font-medium opacity-90">{stage.title}</div>
                  </div>
                </div>
              </div>
              
              {/* Percentual de conversão */}
              <div className="w-16 text-right">
                {index > 0 ? (
                  <span className={`text-sm font-semibold ${conversionRate >= 50 ? 'text-green-600' : conversionRate >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                    {conversionRate}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </Card>
  );
};

export const ResumoTab = ({ prospeccaoIds, prospeccaoId, empresaId }: ResumoTabProps) => {
  const activeIds = prospeccaoIds || (prospeccaoId ? [prospeccaoId] : []);
  const [metas, setMetas] = useState<ProspeccaoMetas | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    totalBase: 0,
    distribuidos: 0,
    atribuidos: 0,
    convidados: 0,
    agendados: 0,
    confirmados: 0,
    checkins: 0,
    vendas: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (activeIds.length === 0 || !empresaId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Buscar metas das prospecções selecionadas
        const { data: prospeccaoData } = await supabase
          .from('prospeccoes')
          .select('meta_convites, meta_confirmacoes, meta_checkins, meta_novos, meta_seminovos, meta_diretas')
          .in('id', activeIds);

        if (prospeccaoData && prospeccaoData.length > 0) {
          // Somar metas de todas as prospecções selecionadas
          const aggregatedMetas: ProspeccaoMetas = {
            meta_convites: prospeccaoData.reduce((sum, p) => sum + (p.meta_convites || 0), 0),
            meta_confirmacoes: prospeccaoData.reduce((sum, p) => sum + (p.meta_confirmacoes || 0), 0),
            meta_checkins: prospeccaoData.reduce((sum, p) => sum + (p.meta_checkins || 0), 0),
            meta_novos: prospeccaoData.reduce((sum, p) => sum + (p.meta_novos || 0), 0),
            meta_seminovos: prospeccaoData.reduce((sum, p) => sum + (p.meta_seminovos || 0), 0),
            meta_diretas: prospeccaoData.reduce((sum, p) => sum + (p.meta_diretas || 0), 0),
          };
          setMetas(aggregatedMetas);
        }

        // Buscar contatos e contar por status
        const { data: contatosData } = await supabase
          .from('contatos')
          .select('status, responsavel_email')
          .eq('empresa_id', empresaId);

        if (contatosData) {
          const counts: StatusCounts = {
            totalBase: contatosData.length,
            distribuidos: 0,
            atribuidos: 0,
            convidados: 0,
            agendados: 0,
            confirmados: 0,
            checkins: 0,
            vendas: 0
          };

          contatosData.forEach(contato => {
            // Contar clientes distribuídos (que têm responsável atribuído)
            if (contato.responsavel_email) {
              counts.distribuidos++;
            }
            switch (contato.status) {
              case 'Atribuído':
                counts.atribuidos++;
                break;
              case 'Convidado':
                counts.convidados++;
                break;
              case 'Agendado':
                counts.agendados++;
                break;
              case 'Confirmado':
                counts.confirmados++;
                break;
              case 'Check-in':
                counts.checkins++;
                break;
              case 'Fechado':
                counts.vendas++;
                break;
            }
          });

          setStatusCounts(counts);
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeIds.join(','), empresaId]);

  // Calcular meta de vendas total
  const metaVendas = useMemo(() => {
    if (!metas) return 0;
    return (metas.meta_novos || 0) + (metas.meta_seminovos || 0) + (metas.meta_diretas || 0);
  }, [metas]);

  // Dados do funil - Cores: vermelho, laranja, verde claro, verde, verde escuro, azul
  const funnelStages: FunnelStage[] = useMemo(() => [
    { id: 'totalBase', title: 'Total da Base', value: statusCounts.totalBase, color: '#EF4444' },      // Vermelho
    { id: 'distribuidos', title: 'Distribuídos', value: statusCounts.atribuidos, color: '#F97316' },   // Laranja
    { id: 'convidados', title: 'Convidados', value: statusCounts.convidados, color: '#84CC16' },       // Verde claro
    { id: 'confirmados', title: 'Confirmados', value: statusCounts.confirmados, color: '#22C55E' },    // Verde
    { id: 'checkins', title: 'Check-Ins', value: statusCounts.checkins, color: '#16A34A' },            // Verde escuro
    { id: 'vendas', title: 'Vendas', value: statusCounts.vendas, color: '#3B82F6' },                   // Azul
  ], [statusCounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activeIds.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Target className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Selecione um Evento</h3>
        <p className="text-sm text-muted-foreground">
          Escolha um ou mais eventos para visualizar o resumo dos resultados
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lado Esquerdo - Funil de Vendas */}
      <div>
        <SalesFunnel stages={funnelStages} />
      </div>

      {/* Lado Direito - Gráficos de Meta */}
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Metas vs Realizado</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetaCard
              title="Meta de Agendamentos"
              icon={<Target className="h-4 w-4 text-blue-600" />}
              realizado={statusCounts.agendados}
              meta={metas?.meta_convites || 0}
              color="bg-blue-100"
            />
            
            <MetaCard
              title="Meta de Confirmações"
              icon={<Users className="h-4 w-4 text-purple-600" />}
              realizado={statusCounts.confirmados}
              meta={metas?.meta_confirmacoes || 0}
              color="bg-purple-100"
            />
            
            <MetaCard
              title="Meta de Check-Ins"
              icon={<UserCheck className="h-4 w-4 text-amber-600" />}
              realizado={statusCounts.checkins}
              meta={metas?.meta_checkins || 0}
              color="bg-amber-100"
            />
            
            <MetaCard
              title="Meta de Vendas"
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
              realizado={statusCounts.vendas}
              meta={metaVendas}
              color="bg-green-100"
            />
          </div>
        </div>

        {/* Demais Indicadores */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Demais Indicadores</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <MetaCard
              title="Distribuição aos Vendedores"
              icon={<UserPlus className="h-4 w-4 text-cyan-600" />}
              realizado={statusCounts.distribuidos}
              meta={statusCounts.totalBase}
              color="bg-cyan-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

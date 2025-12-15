import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Target, Users, UserCheck, TrendingUp, UserPlus, Info, Filter, MessageSquare, CalendarCheck, Store, ShoppingCart } from "lucide-react";
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
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-semibold text-sm">Funil de Vendas</h4>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center space-y-2 h-full">
        {stages.map((stage, index) => {
          const funnelWidths = [100, 85, 70, 55, 42, 30];
          const widthPercentage = funnelWidths[Math.min(index, funnelWidths.length - 1)];
          
          return (
            <div key={stage.id} className="w-full flex items-center justify-center">
              <div
                className="relative flex items-center justify-center text-white font-semibold shadow-sm transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: stage.color,
                  width: `${widthPercentage}%`,
                  height: '53px',
                  borderRadius: '8px'
                }}
              >
                <div className="text-center">
                  <div className="text-xl font-bold">{stage.value.toLocaleString()}</div>
                  <div className="text-xs font-medium opacity-90">{stage.title}</div>
                </div>
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
          .select('id, status, responsavel_email')
          .eq('empresa_id', empresaId);

        // Buscar logs de movimentação para Descartados e Opt Out
        const { data: logsData } = await supabase
          .from('logs_movimentacao_contatos')
          .select('contato_id, status_anterior, status_novo')
          .in('status_novo', ['Descartado', 'Opt Out']);

        if (contatosData) {
          // Criar mapa de status anterior para leads descartados/opt-out
          const statusAnteriorMap = new Map<string, string>();
          if (logsData) {
            logsData.forEach(log => {
              // Guardar o último status anterior registrado
              if (log.status_anterior) {
                statusAnteriorMap.set(log.contato_id, log.status_anterior);
              }
            });
          }

          // Contagem direta por status atual
          const directCounts = {
            vendas: 0,
            checkins: 0,
            confirmados: 0,
            convidados: 0,
            atribuidos: 0,
            emEspera: 0,
            novos: 0,
            descartados: 0,
            optOut: 0
          };

          contatosData.forEach(contato => {
            switch (contato.status) {
              case 'Fechado':
                directCounts.vendas++;
                break;
              case 'Check-in':
                directCounts.checkins++;
                break;
              case 'Confirmado':
                directCounts.confirmados++;
                break;
              case 'Convidado':
                directCounts.convidados++;
                break;
              case 'Atribuído':
                directCounts.atribuidos++;
                break;
              case 'Em Espera':
                directCounts.emEspera++;
                break;
              case 'Novo':
                directCounts.novos++;
                break;
              case 'Descartado':
                directCounts.descartados++;
                break;
              case 'Opt Out':
                directCounts.optOut++;
                break;
            }
          });

          // Para leads descartados/opt-out, contar em qual estágio do funil eles estavam
          const descartadosOptOutPorEstagio = {
            vendas: 0,
            checkins: 0,
            confirmados: 0,
            convidados: 0,
            distribuidos: 0
          };

          contatosData.forEach(contato => {
            if (contato.status === 'Descartado' || contato.status === 'Opt Out') {
              const statusAnterior = statusAnteriorMap.get(contato.id);
              if (statusAnterior) {
                // Acumular baseado no status anterior
                switch (statusAnterior) {
                  case 'Fechado':
                    descartadosOptOutPorEstagio.vendas++;
                    break;
                  case 'Check-in':
                    descartadosOptOutPorEstagio.checkins++;
                    break;
                  case 'Confirmado':
                    descartadosOptOutPorEstagio.confirmados++;
                    break;
                  case 'Convidado':
                    descartadosOptOutPorEstagio.convidados++;
                    break;
                  case 'Atribuído':
                  case 'Em Espera':
                    descartadosOptOutPorEstagio.distribuidos++;
                    break;
                }
              }
            }
          });

          // Calcular valores acumulativos do funil
          // Vendas = só vendas (fechados)
          const vendas = directCounts.vendas;
          
          // Check-ins = vendas + check-ins atuais + descartados/opt-out que estavam em check-in
          const checkins = vendas + directCounts.checkins + descartadosOptOutPorEstagio.checkins;
          
          // Confirmados = check-ins + confirmados atuais + descartados/opt-out que estavam em confirmado
          const confirmados = checkins + directCounts.confirmados + descartadosOptOutPorEstagio.confirmados;
          
          // Convidados = confirmados + convidados atuais + descartados/opt-out que estavam em convidado
          const convidados = confirmados + directCounts.convidados + descartadosOptOutPorEstagio.convidados;
          
          // Distribuídos = convidados + atribuídos + em espera + descartados/opt-out que estavam distribuídos
          const distribuidos = convidados + directCounts.atribuidos + directCounts.emEspera + descartadosOptOutPorEstagio.distribuidos;
          
          // Total da base = todos os contatos
          const totalBase = contatosData.length;

          // Contar distribuídos reais (com responsável) para métricas
          const distribuidosReais = contatosData.filter(c => c.responsavel_email).length;

          setStatusCounts({
            totalBase,
            distribuidos: distribuidos,
            atribuidos: distribuidosReais, // Para o card de distribuição aos vendedores
            convidados,
            agendados: directCounts.convidados, // Agendados = convidados diretos para meta
            confirmados,
            checkins,
            vendas
          });
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

  // Dados do funil - Nova paleta de cores
  const funnelStages: FunnelStage[] = useMemo(() => [
    { id: 'totalBase', title: 'Total da Base', value: statusCounts.totalBase, color: '#FF8F6B' },
    { id: 'distribuidos', title: 'Distribuídos', value: statusCounts.atribuidos, color: '#FFC327' },
    { id: 'convidados', title: 'Convidados', value: statusCounts.convidados, color: '#2EC65C' },
    { id: 'confirmados', title: 'Confirmados', value: statusCounts.confirmados, color: '#5B93FF' },
    { id: 'checkins', title: 'Check-Ins', value: statusCounts.checkins, color: '#605BFF' },
    { id: 'vendas', title: 'Vendas', value: statusCounts.vendas, color: '#4830E4' },
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lado Esquerdo - Funil de Vendas */}
        <div>
          <SalesFunnel stages={funnelStages} />
        </div>

        {/* Lado Direito - Demais Indicadores */}
        <div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetaCard
              title="Distribuição aos Vendedores"
              icon={<UserPlus className="h-4 w-4 text-cyan-600" />}
              realizado={statusCounts.distribuidos}
              meta={statusCounts.totalBase}
              color="bg-cyan-100"
            />
            <MetaCard
              title="% Clientes Convidados"
              icon={<MessageSquare className="h-4 w-4 text-orange-600" />}
              realizado={statusCounts.convidados}
              meta={statusCounts.atribuidos}
              color="bg-orange-100"
            />
            <MetaCard
              title="% Clientes Confirmados"
              icon={<CalendarCheck className="h-4 w-4 text-lime-600" />}
              realizado={statusCounts.confirmados}
              meta={statusCounts.convidados}
              color="bg-lime-100"
            />
            <MetaCard
              title="% Clientes Presentes na Loja"
              icon={<Store className="h-4 w-4 text-green-600" />}
              realizado={statusCounts.checkins}
              meta={statusCounts.confirmados}
              color="bg-green-100"
            />
            <MetaCard
              title="% Vendas / Check-in"
              icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
              realizado={statusCounts.vendas}
              meta={statusCounts.checkins}
              color="bg-blue-100"
            />
            <MetaCard
              title="% Vendas / Total da Base"
              icon={<TrendingUp className="h-4 w-4 text-indigo-600" />}
              realizado={statusCounts.vendas}
              meta={statusCounts.totalBase}
              color="bg-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* Metas vs Realizado - Full Width */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Meta vs Realizado</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
    </div>
  );
};

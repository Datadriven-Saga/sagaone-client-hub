import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Target, Users, UserCheck, TrendingUp, UserPlus, Filter, MessageSquare, CalendarCheck, Store, ShoppingCart } from "lucide-react";

interface ResumoTabProps {
  prospeccaoIds?: string[];
  prospeccaoId?: string | null;
  empresaId: string | null;
}

interface ProspeccaoMetas {
  meta_convites: number;
  meta_confirmacoes: number;
  meta_checkins: number;
  meta_novos: number;
  meta_seminovos: number;
  meta_diretas: number;
}

interface StatusCounts {
  novos: number;
  atribuidos: number;
  emEspera: number;
  convidados: number;
  agendados: number;
  confirmados: number;
  checkins: number;
  vendas: number;
  descartados: number;
  optOut: number;
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
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
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
          <Progress value={progressValue} className="h-3" />
          {exceededMeta && (
            <div className="absolute top-0 left-0 h-3 bg-green-500 rounded-full transition-all" style={{ width: '100%' }} />
          )}
        </div>
        {exceededMeta && (
          <p className="text-xs text-green-600 font-medium">Meta superada em {percentage - 100}%!</p>
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

const SalesFunnel = ({ stages }: { stages: FunnelStage[] }) => (
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
              style={{ backgroundColor: stage.color, width: `${widthPercentage}%`, height: '53px', borderRadius: '8px' }}
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

export const ResumoTab = ({ prospeccaoIds, prospeccaoId, empresaId }: ResumoTabProps) => {
  const activeIds = prospeccaoIds || (prospeccaoId ? [prospeccaoId] : []);
  const [metas, setMetas] = useState<ProspeccaoMetas | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    novos: 0, atribuidos: 0, emEspera: 0, convidados: 0, agendados: 0,
    confirmados: 0, checkins: 0, vendas: 0, descartados: 0, optOut: 0
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
        // Fetch metas and status counts in parallel
        const [metasRes, statsRes] = await Promise.all([
          supabase
            .from('prospeccoes')
            .select('meta_convites, meta_confirmacoes, meta_checkins, meta_novos, meta_seminovos, meta_diretas')
            .in('id', activeIds),
          supabase.rpc('get_resumo_stats', {
            p_prospeccao_ids: activeIds,
            p_empresa_id: empresaId,
          })
        ]);

        // Process metas
        if (metasRes.data && metasRes.data.length > 0) {
          setMetas({
            meta_convites: metasRes.data.reduce((sum, p) => sum + (p.meta_convites || 0), 0),
            meta_confirmacoes: metasRes.data.reduce((sum, p) => sum + (p.meta_confirmacoes || 0), 0),
            meta_checkins: metasRes.data.reduce((sum, p) => sum + (p.meta_checkins || 0), 0),
            meta_novos: metasRes.data.reduce((sum, p) => sum + (p.meta_novos || 0), 0),
            meta_seminovos: metasRes.data.reduce((sum, p) => sum + (p.meta_seminovos || 0), 0),
            meta_diretas: metasRes.data.reduce((sum, p) => sum + (p.meta_diretas || 0), 0),
          });
        }

        // Process status counts from RPC
        const counts: StatusCounts = {
          novos: 0, atribuidos: 0, emEspera: 0, convidados: 0, agendados: 0,
          confirmados: 0, checkins: 0, vendas: 0, descartados: 0, optOut: 0
        };

        if (statsRes.data && Array.isArray(statsRes.data)) {
          (statsRes.data as Array<{ status: string; count: number }>).forEach((row) => {
            switch (row.status) {
              case 'Novo': counts.novos = Number(row.count); break;
              case 'Atribuído': counts.atribuidos = Number(row.count); break;
              case 'Em Espera': counts.emEspera = Number(row.count); break;
              case 'Convidado': counts.convidados = Number(row.count); break;
              case 'Agendado': counts.agendados = Number(row.count); break;
              case 'Confirmado': counts.confirmados = Number(row.count); break;
              case 'Check-in': counts.checkins = Number(row.count); break;
              case 'Fechado': case 'Venda': counts.vendas += Number(row.count); break;
              case 'Descartado': case 'Desperdício': counts.descartados += Number(row.count); break;
              case 'Opt Out': counts.optOut = Number(row.count); break;
            }
          });
        }

        setStatusCounts(counts);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeIds.join(','), empresaId]);

  const metaVendas = useMemo(() => {
    if (!metas) return 0;
    return (metas.meta_novos || 0) + (metas.meta_seminovos || 0) + (metas.meta_diretas || 0);
  }, [metas]);

  const funnelData = useMemo(() => {
    const totalBase = statusCounts.novos + statusCounts.atribuidos + statusCounts.emEspera +
                      statusCounts.convidados + statusCounts.confirmados + statusCounts.checkins +
                      statusCounts.vendas + statusCounts.descartados + statusCounts.optOut;
    const distribuidos = statusCounts.atribuidos + statusCounts.emEspera + statusCounts.convidados +
                         statusCounts.confirmados + statusCounts.checkins + statusCounts.vendas;
    const convidadosAcum = statusCounts.convidados + statusCounts.confirmados +
                           statusCounts.checkins + statusCounts.vendas;
    const confirmadosAcum = statusCounts.confirmados + statusCounts.checkins + statusCounts.vendas;
    const checkinsAcum = statusCounts.checkins + statusCounts.vendas;
    return { totalBase, distribuidos, convidadosAcum, confirmadosAcum, checkinsAcum, vendas: statusCounts.vendas };
  }, [statusCounts]);

  const funnelStages: FunnelStage[] = useMemo(() => [
    { id: 'totalBase', title: 'Total da Base', value: funnelData.totalBase, color: '#FF8F6B' },
    { id: 'distribuidos', title: 'Distribuídos', value: funnelData.distribuidos, color: '#FFC327' },
    { id: 'convidados', title: 'Convidados', value: funnelData.convidadosAcum, color: '#2EC65C' },
    { id: 'confirmados', title: 'Confirmados', value: funnelData.confirmadosAcum, color: '#5B93FF' },
    { id: 'checkins', title: 'Check-ins', value: funnelData.checkinsAcum, color: '#605BFF' },
    { id: 'vendas', title: 'Vendas', value: funnelData.vendas, color: '#4830E4' },
  ], [funnelData]);

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
        <p className="text-sm text-muted-foreground">Escolha um ou mais eventos para visualizar o resumo dos resultados</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div><SalesFunnel stages={funnelStages} /></div>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetaCard title="Distribuição aos Vendedores" icon={<UserPlus className="h-4 w-4 text-cyan-600" />} realizado={funnelData.distribuidos} meta={funnelData.totalBase} color="bg-cyan-100" />
            <MetaCard title="% Clientes Convidados" icon={<MessageSquare className="h-4 w-4 text-orange-600" />} realizado={funnelData.convidadosAcum} meta={funnelData.distribuidos} color="bg-orange-100" />
            <MetaCard title="% Clientes Confirmados" icon={<CalendarCheck className="h-4 w-4 text-lime-600" />} realizado={funnelData.confirmadosAcum} meta={funnelData.convidadosAcum} color="bg-lime-100" />
            <MetaCard title="% Clientes Presentes na Loja" icon={<Store className="h-4 w-4 text-green-600" />} realizado={funnelData.checkinsAcum} meta={funnelData.confirmadosAcum} color="bg-green-100" />
            <MetaCard title="% Vendas / Check-in" icon={<ShoppingCart className="h-4 w-4 text-blue-600" />} realizado={funnelData.vendas} meta={funnelData.checkinsAcum} color="bg-blue-100" />
            <MetaCard title="% Vendas / Total da Base" icon={<TrendingUp className="h-4 w-4 text-indigo-600" />} realizado={funnelData.vendas} meta={funnelData.totalBase} color="bg-indigo-100" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Meta vs Realizado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetaCard title="Meta de Agendamentos" icon={<Target className="h-4 w-4 text-blue-600" />} realizado={funnelData.convidadosAcum} meta={metas?.meta_convites || 0} color="bg-blue-100" />
          <MetaCard title="Meta de Confirmações" icon={<Users className="h-4 w-4 text-purple-600" />} realizado={funnelData.confirmadosAcum} meta={metas?.meta_confirmacoes || 0} color="bg-purple-100" />
          <MetaCard title="Meta de Check-Ins" icon={<UserCheck className="h-4 w-4 text-amber-600" />} realizado={funnelData.checkinsAcum} meta={metas?.meta_checkins || 0} color="bg-amber-100" />
          <MetaCard title="Meta de Vendas" icon={<TrendingUp className="h-4 w-4 text-green-600" />} realizado={funnelData.vendas} meta={metaVendas} color="bg-green-100" />
        </div>
      </div>
    </div>
  );
};

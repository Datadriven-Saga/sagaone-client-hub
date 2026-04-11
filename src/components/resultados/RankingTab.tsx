import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Users, Calendar } from "lucide-react";

interface RankingTabProps {
  prospeccaoIds?: string[];
  prospeccaoId?: string | null; // backward compat
  empresaId: string | null;
}

interface VendedorRanking {
  userId: string;
  nomeCompleto: string;
  convidados: number;
  checkins: number;
  vendas: number;
}

export const RankingTab = ({ prospeccaoIds, prospeccaoId, empresaId }: RankingTabProps) => {
  const activeIds = prospeccaoIds || (prospeccaoId ? [prospeccaoId] : []);
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<VendedorRanking[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (activeIds.length === 0 || !empresaId) {
        setVendedores([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_ranking_vendedores', {
          p_prospeccao_ids: activeIds,
          p_empresa_id: empresaId,
          p_date_start: dateStart ? new Date(dateStart).toISOString() : null,
          p_date_end: dateEnd ? new Date(dateEnd + 'T23:59:59').toISOString() : null,
        });

        if (error) {
          console.error('Erro ao buscar ranking:', error);
          setVendedores([]);
        } else if (data && Array.isArray(data)) {
          setVendedores(
            (data as Array<{ user_id: string; nome_completo: string; convidados: number; checkins: number; vendas: number }>).map((row) => ({
              userId: row.user_id,
              nomeCompleto: row.nome_completo || 'Sem nome',
              convidados: Number(row.convidados),
              checkins: Number(row.checkins),
              vendas: Number(row.vendas),
            }))
          );
        }
      } catch (error) {
        console.error('Erro ao buscar dados do ranking:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeIds.join(','), empresaId, dateStart, dateEnd]);

  const rankingProspectores = useMemo(() =>
    [...vendedores].sort((a, b) => b.convidados - a.convidados).filter(v => v.convidados > 0),
    [vendedores]
  );

  const rankingCheckin = useMemo(() =>
    [...vendedores].sort((a, b) => b.checkins - a.checkins).filter(v => v.checkins > 0),
    [vendedores]
  );

  const rankingVendas = useMemo(() =>
    [...vendedores].sort((a, b) => b.vendas - a.vendas).filter(v => v.vendas > 0),
    [vendedores]
  );

  const getMedalColor = (position: number) => {
    switch (position) {
      case 0: return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', icon: 'text-yellow-500' };
      case 1: return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', icon: 'text-gray-400' };
      case 2: return { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', icon: 'text-orange-500' };
      default: return { bg: 'bg-muted/50', border: 'border-border', text: 'text-foreground', icon: 'text-muted-foreground' };
    }
  };

  const getMedalLabel = (position: number) => {
    switch (position) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `${position + 1}º`;
    }
  };

  const RankingCard = ({
    title, icon: Icon, data, valueKey
  }: {
    title: string; icon: React.ElementType; data: VendedorRanking[];
    valueKey: 'convidados' | 'checkins' | 'vendas';
  }) => (
    <Card className="p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Nenhum dado disponível</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((vendedor, index) => {
            const colors = getMedalColor(index);
            const isTopThree = index < 3;
            return (
              <div
                key={vendedor.userId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isTopThree ? `${colors.bg} ${colors.border} border-2` : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold min-w-[2rem] ${isTopThree ? colors.text : 'text-muted-foreground'}`}>
                    {getMedalLabel(index)}
                  </span>
                  <span className={`font-medium ${isTopThree ? colors.text : 'text-foreground'}`}>
                    {vendedor.nomeCompleto}
                  </span>
                </div>
                <span className={`font-bold text-lg ${isTopThree ? colors.text : 'text-foreground'}`}>
                  {vendedor[valueKey]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  if (activeIds.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Selecione uma Prospecção</h3>
        <p className="text-sm text-muted-foreground">Selecione uma prospecção para visualizar os rankings</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 h-64 animate-pulse">
            <div className="h-6 bg-muted rounded w-1/2 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(j => <div key={j} className="h-12 bg-muted rounded" />)}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[150px]">
            <label className="text-sm font-medium mb-1.5 block">Data Início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="w-[150px]">
            <label className="text-sm font-medium mb-1.5 block">Data Fim</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="pl-9" />
            </div>
          </div>
          {(dateStart || dateEnd) && (
            <Button variant="outline" size="sm" onClick={() => { setDateStart(""); setDateEnd(""); }}>
              Limpar Datas
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankingCard title="Ranking de Prospectores" icon={Medal} data={rankingProspectores} valueKey="convidados" />
        <RankingCard title="Ranking de Check-in" icon={Award} data={rankingCheckin} valueKey="checkins" />
        <RankingCard title="Ranking de Vendas" icon={Trophy} data={rankingVendas} valueKey="vendas" />
      </div>
    </div>
  );
};

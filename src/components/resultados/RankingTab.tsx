import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Users } from "lucide-react";

interface RankingTabProps {
  prospeccaoId: string | null;
  empresaId: string | null;
}

interface VendedorRanking {
  userId: string;
  nomeCompleto: string;
  convidados: number;
  checkins: number;
  vendas: number;
}

export const RankingTab = ({ prospeccaoId, empresaId }: RankingTabProps) => {
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<VendedorRanking[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!prospeccaoId || !empresaId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Buscar equipes da prospecção
        const { data: equipes } = await supabase
          .from('prospeccao_equipes')
          .select('id')
          .eq('prospeccao_id', prospeccaoId)
          .eq('empresa_id', empresaId);

        if (!equipes || equipes.length === 0) {
          setVendedores([]);
          setLoading(false);
          return;
        }

        const equipeIds = equipes.map(e => e.id);

        // Buscar membros das equipes
        const { data: membros } = await supabase
          .from('prospeccao_equipe_membros')
          .select('user_id')
          .in('equipe_id', equipeIds);

        if (!membros || membros.length === 0) {
          setVendedores([]);
          setLoading(false);
          return;
        }

        const userIds = [...new Set(membros.map(m => m.user_id))];

        // Buscar profiles dos usuários
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome_completo, celular')
          .in('id', userIds);

        // Buscar contatos vinculados ao evento via eventos_prospeccao
        const { data: eventosData } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccaoId);

        if (!eventosData || eventosData.length === 0) {
          // Inicializar vendedores com zeros
          const vendedoresZerados = profiles?.map(profile => ({
            userId: profile.id,
            nomeCompleto: profile.nome_completo || 'Sem nome',
            convidados: 0,
            checkins: 0,
            vendas: 0
          })) || [];
          setVendedores(vendedoresZerados);
          setLoading(false);
          return;
        }

        const contatoIds = [...new Set(eventosData.map(e => e.contato_id).filter(Boolean))];

        // Buscar contatos da prospecção (apenas os vinculados ao evento)
        const { data: contatos } = await supabase
          .from('contatos')
          .select('id, responsavel_email, status')
          .eq('empresa_id', empresaId)
          .in('id', contatoIds);

        // Mapear dados dos vendedores
        const vendedoresMap = new Map<string, VendedorRanking>();

        profiles?.forEach(profile => {
          vendedoresMap.set(profile.id, {
            userId: profile.id,
            nomeCompleto: profile.nome_completo || 'Sem nome',
            convidados: 0,
            checkins: 0,
            vendas: 0
          });
        });

        // Contar métricas por vendedor
        contatos?.forEach(contato => {
          if (!contato.responsavel_email) return;

          // Encontrar o profile correspondente (por ID, email ou celular)
          let matchedProfile: typeof profiles extends (infer T)[] ? T : never | undefined;
          
          profiles?.forEach(profile => {
            if (
              contato.responsavel_email === profile.id ||
              contato.responsavel_email === profile.celular
            ) {
              matchedProfile = profile;
            }
          });

          if (matchedProfile) {
            const vendedor = vendedoresMap.get(matchedProfile.id);
            if (vendedor) {
              // Status que indicam convite: Convidado, Confirmado, Check-in, Fechado/Venda
              if (['Convidado', 'Confirmado', 'Check-in', 'Fechado', 'Venda'].includes(contato.status || '')) {
                vendedor.convidados++;
              }
              // Status que indicam check-in: Check-in, Fechado/Venda
              if (['Check-in', 'Fechado', 'Venda'].includes(contato.status || '')) {
                vendedor.checkins++;
              }
              // Status que indicam venda: Fechado/Venda
              if (['Fechado', 'Venda'].includes(contato.status || '')) {
                vendedor.vendas++;
              }
            }
          }
        });

        setVendedores(Array.from(vendedoresMap.values()));
      } catch (error) {
        console.error('Erro ao buscar dados do ranking:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prospeccaoId, empresaId]);

  // Rankings ordenados
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
    title, 
    icon: Icon, 
    data, 
    valueKey 
  }: { 
    title: string; 
    icon: React.ElementType; 
    data: VendedorRanking[]; 
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
                  isTopThree 
                    ? `${colors.bg} ${colors.border} border-2` 
                    : 'bg-muted/30 border-border'
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

  if (!prospeccaoId) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Selecione uma Prospecção</h3>
        <p className="text-sm text-muted-foreground">
          Selecione uma prospecção no resumo para visualizar os rankings
        </p>
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
              {[1, 2, 3].map(j => (
                <div key={j} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <RankingCard 
        title="Ranking de Prospectores" 
        icon={Medal} 
        data={rankingProspectores} 
        valueKey="convidados" 
      />
      <RankingCard 
        title="Ranking de Check-in" 
        icon={Award} 
        data={rankingCheckin} 
        valueKey="checkins" 
      />
      <RankingCard 
        title="Ranking de Vendas" 
        icon={Trophy} 
        data={rankingVendas} 
        valueKey="vendas" 
      />
    </div>
  );
};

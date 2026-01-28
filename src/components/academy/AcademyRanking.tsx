import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface RankingEntry {
  position: number;
  user_id: string;
  user_name: string;
  department: string;
  score: number;
  simulations_count: number;
  trend: "up" | "down" | "stable";
}

export function AcademyRanking() {
  const { activeCompany } = useCompany();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany?.id) {
      setLoading(false);
      return;
    }

    async function fetchRankingData() {
      try {
        // Fetch profiles from the active company
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nome_completo, departamento, tipo_acesso, status")
          .eq("empresa_id", activeCompany.id)
          .eq("status", "Ativo")
          .not("nome_completo", "is", null);

        if (profilesError) throw profilesError;

        if (!profiles || profiles.length === 0) {
          setRanking([]);
          setLoading(false);
          return;
        }

        // Fetch training progress for these users
        const userIds = profiles.map(p => p.id);
        const { data: progressData, error: progressError } = await supabase
          .from("treinamento_progresso")
          .select("user_id, nota, status")
          .in("user_id", userIds);

        if (progressError) throw progressError;

        // Calculate scores and simulations per user
        const userStats: Record<string, { totalScore: number; count: number; simulations: number }> = {};
        
        profiles.forEach(profile => {
          userStats[profile.id] = { totalScore: 0, count: 0, simulations: 0 };
        });

        if (progressData) {
          progressData.forEach(progress => {
            if (userStats[progress.user_id]) {
              userStats[progress.user_id].simulations += 1;
              if (progress.nota) {
                userStats[progress.user_id].totalScore += Number(progress.nota);
                userStats[progress.user_id].count += 1;
              }
            }
          });
        }

        // Build ranking entries
        const rankingEntries: RankingEntry[] = profiles.map(profile => {
          const stats = userStats[profile.id];
          const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
          
          // Generate mock trend for now (in production, compare with previous period)
          const trends: ("up" | "down" | "stable")[] = ["up", "down", "stable"];
          const randomTrend = trends[Math.floor(Math.random() * trends.length)];

          return {
            position: 0, // Will be set after sorting
            user_id: profile.id,
            user_name: profile.nome_completo || "Sem nome",
            department: profile.departamento || profile.tipo_acesso || "Geral",
            score: avgScore,
            simulations_count: stats.simulations,
            trend: randomTrend,
          };
        });

        // Sort by score (desc), then by simulations (desc)
        rankingEntries.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.simulations_count - a.simulations_count;
        });

        // Assign positions
        rankingEntries.forEach((entry, index) => {
          entry.position = index + 1;
        });

        setRanking(rankingEntries);
      } catch (error) {
        console.error("Erro ao buscar ranking:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRankingData();
  }, [activeCompany?.id]);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center font-bold text-muted-foreground">
            {position}
          </span>
        );
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get top 3 for podium (reorder: 2nd, 1st, 3rd)
  const topThree = ranking.slice(0, 3);
  const second = topThree[1];
  const first = topThree[0];
  const third = topThree[2];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ranking de Performance</h1>
        <p className="text-muted-foreground">
          Classificação dos colaboradores com base nas simulações realizadas
        </p>
      </div>

      {ranking.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum colaborador encontrado. Os usuários serão exibidos aqui conforme realizarem simulações.
          </p>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {/* 2nd Place */}
              <div className="flex flex-col items-center mt-8">
                <Avatar className="h-16 w-16 mb-2 ring-4 ring-gray-300">
                  <AvatarFallback className="bg-gray-100 text-gray-700 text-xl">
                    {second?.user_name ? getInitials(second.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Medal className="h-8 w-8 text-gray-400 -mt-4 mb-2" />
                <p className="font-semibold text-center">{second?.user_name}</p>
                <Badge variant="outline" className="mt-1">{second?.score.toFixed(1)}</Badge>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center">
                <Avatar className="h-20 w-20 mb-2 ring-4 ring-yellow-400">
                  <AvatarFallback className="bg-yellow-100 text-yellow-700 text-2xl">
                    {first?.user_name ? getInitials(first.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Trophy className="h-10 w-10 text-yellow-500 -mt-4 mb-2" />
                <p className="font-bold text-lg text-center">{first?.user_name}</p>
                <Badge className="mt-1 bg-yellow-100 text-yellow-700">{first?.score.toFixed(1)}</Badge>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center mt-12">
                <Avatar className="h-14 w-14 mb-2 ring-4 ring-amber-400">
                  <AvatarFallback className="bg-amber-100 text-amber-700 text-lg">
                    {third?.user_name ? getInitials(third.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Award className="h-7 w-7 text-amber-600 -mt-3 mb-2" />
                <p className="font-semibold text-center text-sm">{third?.user_name}</p>
                <Badge variant="outline" className="mt-1">{third?.score.toFixed(1)}</Badge>
              </div>
            </div>
          )}

          {/* Full Ranking Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Posição</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-center">Simulações</TableHead>
                  <TableHead className="text-center">Nota Média</TableHead>
                  <TableHead className="text-center">Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((entry) => (
                  <TableRow
                    key={entry.user_id}
                    className={cn(
                      entry.position <= 3 && "bg-muted/30"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getPositionIcon(entry.position)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(entry.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{entry.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.department}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.simulations_count.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          entry.score >= 7
                            ? "bg-green-100 text-green-700"
                            : entry.score >= 5
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {entry.score.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {getTrendIcon(entry.trend)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

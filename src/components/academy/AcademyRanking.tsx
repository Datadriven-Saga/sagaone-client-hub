import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcademyRanking } from "@/hooks/useAcademyData";
import { AcademyPageHeader } from "./AcademyPageHeader";

export function AcademyRanking() {
  const { data: ranking, isLoading } = useAcademyRanking(50);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Transform ranking data
  const rankingEntries = (ranking || []).map((item: any, index: number) => ({
    position: item.posicao || index + 1,
    user_id: item.user_id,
    user_name: item.profile?.nome_completo || "Sem nome",
    department: item.profile?.departamento || item.profile?.tipo_acesso || "Geral",
    score: Number(item.media_geral || 0),
    simulations_count: item.total_simulacoes_realizadas || 0,
    trend: "stable" as const,
  }));

  // Get top 3 for podium
  const first = rankingEntries[0];
  const second = rankingEntries[1];
  const third = rankingEntries[2];

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <AcademyPageHeader
        title="Ranking de Performance"
        description="Classificação dos colaboradores com base nas simulações realizadas"
        icon={<Trophy className="h-6 w-6 text-sagaone-login-card" />}
      />

      {rankingEntries.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Nenhum colaborador no ranking ainda. Os usuários aparecerão aqui conforme realizarem simulações.
          </p>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium */}
          {rankingEntries.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 md:gap-4 max-w-2xl mx-auto">
              {/* 2nd Place */}
              <div className="flex flex-col items-center mt-8">
                <Avatar className="h-12 md:h-16 w-12 md:w-16 mb-2 ring-4 ring-gray-300">
                  <AvatarFallback className="bg-gray-100 text-gray-700 text-lg md:text-xl dark:bg-gray-800 dark:text-gray-300">
                    {second?.user_name ? getInitials(second.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Medal className="h-6 md:h-8 w-6 md:w-8 text-gray-400 -mt-4 mb-2" />
                <p className="font-semibold text-center text-xs md:text-sm truncate max-w-full px-1">{second?.user_name}</p>
                <Badge variant="outline" className="mt-1 text-xs">{second?.score.toFixed(1)}</Badge>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center">
                <Avatar className="h-16 md:h-20 w-16 md:w-20 mb-2 ring-4 ring-yellow-400">
                  <AvatarFallback className="bg-yellow-100 text-yellow-700 text-xl md:text-2xl dark:bg-yellow-900/30 dark:text-yellow-400">
                    {first?.user_name ? getInitials(first.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Trophy className="h-8 md:h-10 w-8 md:w-10 text-yellow-500 -mt-4 mb-2" />
                <p className="font-bold text-sm md:text-lg text-center truncate max-w-full px-1">{first?.user_name}</p>
                <Badge className="mt-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">{first?.score.toFixed(1)}</Badge>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center mt-12">
                <Avatar className="h-10 md:h-14 w-10 md:w-14 mb-2 ring-4 ring-amber-400">
                  <AvatarFallback className="bg-amber-100 text-amber-700 text-sm md:text-lg dark:bg-amber-900/30 dark:text-amber-400">
                    {third?.user_name ? getInitials(third.user_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Award className="h-5 md:h-7 w-5 md:w-7 text-amber-600 -mt-3 mb-2" />
                <p className="font-semibold text-center text-xs truncate max-w-full px-1">{third?.user_name}</p>
                <Badge variant="outline" className="mt-1 text-xs">{third?.score.toFixed(1)}</Badge>
              </div>
            </div>
          )}

          {/* Full Ranking Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pos.</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="hidden md:table-cell">Departamento</TableHead>
                    <TableHead className="text-center">Sim.</TableHead>
                    <TableHead className="text-center">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingEntries.map((entry) => (
                    <TableRow
                      key={entry.user_id}
                      className={cn(entry.position <= 3 && "bg-muted/30")}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getPositionIcon(entry.position)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 md:gap-3">
                          <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm">
                              {getInitials(entry.user_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate max-w-[120px] md:max-w-none">{entry.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">{entry.department}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.simulations_count}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-xs",
                            entry.score >= 7
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : entry.score >= 5
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {entry.score.toFixed(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

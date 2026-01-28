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
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award } from "lucide-react";
import { RankingEntry } from "@/types/academy";
import { cn } from "@/lib/utils";

// Mock ranking data
const mockRanking: RankingEntry[] = [
  {
    position: 1,
    user_id: "1",
    user_name: "Ana Silva",
    department: "Vendas Novos",
    score: 8.7,
    simulations_count: 24,
    trend: "up",
  },
  {
    position: 2,
    user_id: "2",
    user_name: "Carlos Santos",
    department: "Pós-Venda",
    score: 8.2,
    simulations_count: 18,
    trend: "stable",
  },
  {
    position: 3,
    user_id: "3",
    user_name: "Marina Costa",
    department: "Vendas Usados",
    score: 7.9,
    simulations_count: 21,
    trend: "up",
  },
  {
    position: 4,
    user_id: "4",
    user_name: "Pedro Lima",
    department: "F&I",
    score: 7.5,
    simulations_count: 15,
    trend: "down",
  },
  {
    position: 5,
    user_id: "5",
    user_name: "Julia Almeida",
    department: "Vendas Novos",
    score: 7.3,
    simulations_count: 12,
    trend: "up",
  },
];

export function AcademyRanking() {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ranking de Performance</h1>
        <p className="text-muted-foreground">
          Classificação dos colaboradores com base nas simulações realizadas
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        {/* 2nd Place */}
        <div className="flex flex-col items-center mt-8">
          <Avatar className="h-16 w-16 mb-2 ring-4 ring-gray-300">
            <AvatarFallback className="bg-gray-100 text-gray-700 text-xl">
              {mockRanking[1]?.user_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <Medal className="h-8 w-8 text-gray-400 -mt-4 mb-2" />
          <p className="font-semibold text-center">{mockRanking[1]?.user_name}</p>
          <Badge variant="outline" className="mt-1">{mockRanking[1]?.score.toFixed(1)}</Badge>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center">
          <Avatar className="h-20 w-20 mb-2 ring-4 ring-yellow-400">
            <AvatarFallback className="bg-yellow-100 text-yellow-700 text-2xl">
              {mockRanking[0]?.user_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <Trophy className="h-10 w-10 text-yellow-500 -mt-4 mb-2" />
          <p className="font-bold text-lg text-center">{mockRanking[0]?.user_name}</p>
          <Badge className="mt-1 bg-yellow-100 text-yellow-700">{mockRanking[0]?.score.toFixed(1)}</Badge>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center mt-12">
          <Avatar className="h-14 w-14 mb-2 ring-4 ring-amber-400">
            <AvatarFallback className="bg-amber-100 text-amber-700 text-lg">
              {mockRanking[2]?.user_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <Award className="h-7 w-7 text-amber-600 -mt-3 mb-2" />
          <p className="font-semibold text-center text-sm">{mockRanking[2]?.user_name}</p>
          <Badge variant="outline" className="mt-1">{mockRanking[2]?.score.toFixed(1)}</Badge>
        </div>
      </div>

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
            {mockRanking.map((entry) => (
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
                        {entry.user_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{entry.user_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.department}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {entry.simulations_count}
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
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Calendar, Clock, Mic, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAcademySessoes } from "@/hooks/useAcademyData";

export function SimulationHistory() {
  const navigate = useNavigate();
  const { data: sessoes, isLoading } = useAcademySessoes();

  const getScoreColor = (score: number) => {
    if (score >= 7) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 4) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get persona name from transcription or cenario
  const getPersonaName = (sessao: any): string => {
    const simulacao = sessao.simulacao;
    if (!simulacao) return "Persona";
    
    const cenario = simulacao.cenario as any;
    if (cenario?.personas?.[0]?.nome) {
      return cenario.personas[0].nome;
    }
    if (cenario?.personas?.[0]?.name) {
      return cenario.personas[0].name;
    }
    return "Cliente";
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Histórico de Simulações</h1>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !sessoes?.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Você ainda não realizou nenhuma simulação.</p>
            <p className="text-sm mt-2">Complete uma simulação para ver seu histórico aqui.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Simulação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden sm:table-cell">Data</TableHead>
                <TableHead className="hidden md:table-cell">Duração</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessoes.map((sessao: any) => {
                const simulacao = sessao.simulacao;
                const isVoice = simulacao?.tipo === "simulacao_voz" || simulacao?.tipo === "simulacao";
                const personaName = getPersonaName(sessao);
                const score = Number(sessao.nota_final || 0);
                
                return (
                  <TableRow key={sessao.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {personaName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{simulacao?.titulo || "Simulação"}</p>
                          <p className="text-sm text-muted-foreground">
                            com {personaName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {isVoice ? (
                          <Mic className="h-3 w-3" />
                        ) : (
                          <MessageSquare className="h-3 w-3" />
                        )}
                        {isVoice ? "Voz" : "Texto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(sessao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatDuration(sessao.duracao_segundos)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sessao.status === "concluida" ? (
                        <Badge className={getScoreColor(score)}>
                          {score.toFixed(0)}/10
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {sessao.status === "em_andamento" ? "Em andamento" : sessao.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/treinamentos/historico/${sessao.id}`)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">Ver detalhes</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

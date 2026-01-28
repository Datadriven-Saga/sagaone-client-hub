import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface HistoryEntry {
  id: string;
  scenario_title: string;
  persona_name: string;
  type: "voice" | "text";
  date: string;
  duration: string;
  score: number;
}

// Mock history data
const mockHistory: HistoryEntry[] = [
  {
    id: "1",
    scenario_title: "Atendimento Veículo Novo",
    persona_name: "Lucas",
    type: "voice",
    date: "2025-01-28T14:30:00",
    duration: "00:02:09",
    score: 4,
  },
  {
    id: "2",
    scenario_title: "Prospecção Outbound",
    persona_name: "Marina",
    type: "voice",
    date: "2025-01-27T10:15:00",
    duration: "00:05:23",
    score: 7,
  },
  {
    id: "3",
    scenario_title: "Atendimento Pós-Venda",
    persona_name: "Carlos",
    type: "text",
    date: "2025-01-26T16:45:00",
    duration: "00:08:12",
    score: 5,
  },
];

export function SimulationHistory() {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 7) return "bg-green-100 text-green-700";
    if (score >= 4) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Histórico de Simulações</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Simulação</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockHistory.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {entry.persona_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{entry.scenario_title}</p>
                      <p className="text-sm text-muted-foreground">
                        com {entry.persona_name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    {entry.type === "voice" ? (
                      <Mic className="h-3 w-3" />
                    ) : (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    {entry.type === "voice" ? "Voz" : "Texto"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(entry.date), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {entry.duration}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getScoreColor(entry.score)}>
                    {entry.score}/10
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/treinamentos/historico/${entry.id}`)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Ver detalhes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

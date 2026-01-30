import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Eye, 
  Calendar, 
  Clock, 
  Mic, 
  MessageSquare,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  History
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAcademyAllSessoes } from "@/hooks/useAcademyData";
import { AcademyPageHeader } from "./AcademyPageHeader";

const ITEMS_PER_PAGE = 15;

export function SimulationHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [page, setPage] = useState(1);
  
  const { data: result, isLoading } = useAcademyAllSessoes({
    searchTerm,
    tipo: tipoFilter,
    page,
    pageSize: ITEMS_PER_PAGE,
  });
  
  const sessoes = result?.data || [];
  const total = result?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

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

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "voz":
      case "simulacao":
      case "simulacao_voz":
        return "Outbound (Voz)";
      case "texto":
      case "simulacao_texto":
        return "Inbound (Texto)";
      default:
        return tipo || "—";
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setPage(1);
  };

  const hasActiveFilters = searchTerm || tipoFilter !== "all";

  return (
    <div className="space-y-6">
      <AcademyPageHeader
        title="Histórico"
        description="Visualize todas as suas simulações realizadas"
        icon={<History className="h-6 w-6 text-sagaone-login-card" />}
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, usuário ou simulação..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          
          <Select 
            value={tipoFilter} 
            onValueChange={(v) => {
              setTipoFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo de reunião" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="voz">Outbound (Voz)</SelectItem>
              <SelectItem value="texto">Inbound (Texto)</SelectItem>
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </Card>

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
            <p>Nenhuma simulação encontrada.</p>
            <p className="text-sm mt-2">Complete uma simulação para ver o histórico aqui.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID do feedback</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Personagem</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo de reunião</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    <TableHead className="hidden sm:table-cell">Duração</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessoes.map((sessao: any) => {
                    const simulacao = sessao.simulacao;
                    const isVoice = simulacao?.tipo === "simulacao_voz" || simulacao?.tipo === "simulacao";
                    const personaName = getPersonaName(sessao);
                    const score = Number(sessao.nota_final || 0);
                    const userName = sessao.profile?.nome_completo || "Usuário";
                    
                    return (
                      <TableRow 
                        key={sessao.id}
                        className="cursor-pointer hover:bg-muted/70"
                        onClick={() => navigate(`/treinamentos/historico/${sessao.id}`)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {sessao.id.substring(0, 36)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {userName}
                        </TableCell>
                        <TableCell>
                          {personaName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">
                            {getTipoLabel(simulacao?.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {sessao.status === "concluida" ? (
                            <span className="font-medium">{score}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDuration(sessao.duracao_segundos)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(sessao.data_inicio), "dd-MM-yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/treinamentos/historico/${sessao.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(page * ITEMS_PER_PAGE, total)} de {total.toLocaleString("pt-BR")} registros
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

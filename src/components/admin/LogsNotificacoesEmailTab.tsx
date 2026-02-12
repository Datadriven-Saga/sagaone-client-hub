import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEmail {
  id: string;
  tipo: string;
  assunto: string;
  destinatario_email: string;
  destinatario_nome: string | null;
  status: string;
  erro: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  enviado_por: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export function LogsNotificacoesEmailTab() {
  const [logs, setLogs] = useState<LogEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('logs_notificacoes_email')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq('status', filtroStatus);
      }
      if (searchText.trim()) {
        query = query.or(`destinatario_email.ilike.%${searchText}%,destinatario_nome.ilike.%${searchText}%,assunto.ilike.%${searchText}%,erro.ilike.%${searchText}%`);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Erro ao buscar logs de email:', error);
        return;
      }

      setLogs((data as LogEmail[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filtroStatus, searchText]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusBadge = (status: string, erro: string | null) => {
    switch (status) {
      case 'enviado':
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Enviado
          </Badge>
        );
      case 'erro':
        return (
          <Badge className="bg-red-100 text-red-800 gap-1" title={erro || undefined}>
            <XCircle className="w-3 h-3" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 gap-1">
            <Clock className="w-3 h-3" />
            Pendente
          </Badge>
        );
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'evento_criado':
        return <Badge variant="secondary">Evento Criado</Badge>;
      case 'evento_editado':
        return <Badge variant="secondary">Evento Editado</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome, assunto ou erro..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(0); }}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum log de notificação encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{getTipoBadge(log.tipo)}</TableCell>
                    <TableCell>
                      <div>
                        {log.destinatario_nome && (
                          <p className="text-sm font-medium">{log.destinatario_nome}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{log.destinatario_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {log.assunto}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status, log.erro)}</TableCell>
                    <TableCell className="max-w-[200px] text-xs text-destructive truncate" title={log.erro || undefined}>
                      {log.erro || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              {totalCount} registro{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

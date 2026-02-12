import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, DollarSign, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface LogDisparo {
  id: string;
  usuario_nome: string;
  usuario_email: string;
  usuario_perfil: string;
  evento_nome: string;
  canal: string;
  total_contatos: number;
  cotacao_dolar: number;
  custo_total_usd: number;
  custo_total_brl: number;
  disparo_id: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const LogsDisparos = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogDisparo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [filtroEvento, setFiltroEvento] = useState("todos");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Unique values for filters
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [eventos, setEventos] = useState<string[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('logs_disparos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filtroUsuario !== "todos") {
        query = query.eq('usuario_email', filtroUsuario);
      }
      if (filtroEvento !== "todos") {
        query = query.eq('evento_nome', filtroEvento);
      }
      if (searchText.trim()) {
        query = query.or(`usuario_nome.ilike.%${searchText}%,usuario_email.ilike.%${searchText}%,evento_nome.ilike.%${searchText}%,disparo_id.ilike.%${searchText}%`);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Erro ao buscar logs:', error);
        return;
      }

      setLogs((data as LogDisparo[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unique filter values
  useEffect(() => {
    const fetchFilterValues = async () => {
      const { data: logsData } = await supabase
        .from('logs_disparos')
        .select('usuario_email, evento_nome');

      if (logsData) {
        const uniqueUsers = [...new Set(logsData.map(l => l.usuario_email))].sort();
        const uniqueEvents = [...new Set(logsData.map(l => l.evento_nome))].sort();
        setUsuarios(uniqueUsers);
        setEventos(uniqueEvents);
      }
    };
    fetchFilterValues();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filtroUsuario, filtroEvento, searchText]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const getCanalBadge = (canal: string) => {
    const c = String(canal).toLowerCase();
    if (c.includes('liga') || c === 'ligação') return <Badge className="bg-orange-100 text-orange-800">IA Ligação</Badge>;
    return <Badge className="bg-green-100 text-green-800">IA WhatsApp</Badge>;
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/administracao')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                Logs de Disparos
              </h1>
              <p className="text-sm text-muted-foreground">
                Registro de auditoria de todos os disparos realizados
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, evento ou ID..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={filtroUsuario} onValueChange={(v) => { setFiltroUsuario(v); setPage(0); }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Usuários</SelectItem>
                  {usuarios.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroEvento} onValueChange={(v) => { setFiltroEvento(v); setPage(0); }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Eventos</SelectItem>
                  {eventos.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
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
                Nenhum log de disparo encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Contatos</TableHead>
                      <TableHead className="text-right">USD/BRL</TableHead>
                      <TableHead className="text-right">Total USD</TableHead>
                      <TableHead className="text-right">Total BRL</TableHead>
                      <TableHead>ID Disparo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{log.usuario_nome}</p>
                            <p className="text-xs text-muted-foreground">{log.usuario_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{log.usuario_perfil}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">{log.evento_nome}</TableCell>
                        <TableCell>{getCanalBadge(log.canal)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {log.total_contatos.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatBRL(log.cotacao_dolar)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatUSD(log.custo_total_usd)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-primary">
                          {formatBRL(log.custo_total_brl)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {log.disparo_id.substring(0, 8)}...
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
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default LogsDisparos;

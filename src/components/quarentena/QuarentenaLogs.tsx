import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LogEntry {
  id: string;
  quarentena_id: string | null;
  telefone_normalizado: string;
  marca: string | null;
  empresa_id: string | null;
  acao: string;
  usuario_id: string | null;
  usuario_email: string | null;
  detalhes: string | null;
  created_at: string;
}

const acaoLabels: Record<string, string> = {
  desativado_manual: "Desativado manualmente",
  reativado: "Reativado",
  desativado_bulk: "Desativado em massa",
};

export function QuarentenaLogs() {
  const { activeCompany } = useCompany();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("quarentena_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (activeCompany?.id) {
        query = query.eq("empresa_id", activeCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as LogEntry[]) || []);
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
      toast.error("Erro ao carregar logs de quarentena");
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Histórico de ações realizadas na quarentena</p>
        <Button variant="outline" size="icon" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum log de quarentena encontrado
                </TableCell>
              </TableRow>
            ) : (
              logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">{log.usuario_email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {acaoLabels[log.acao] || log.acao}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.telefone_normalizado}</TableCell>
                  <TableCell className="text-sm">{log.marca || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                    {log.detalhes || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Search, FileText, Loader2, Lock, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

interface RelatorioConvidadosTabProps {
  empresaId: string | null;
  prospeccoes: Array<{ id: string; titulo: string }>;
}

interface RelatorioRow {
  contato_id: string;
  lead_id: number | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  status_atual: string;
  data_convite: string;
  convidado_por: string | null;
  convidado_por_nome: string | null;
  evento_nome: string | null;
  prospeccao_id: string | null;
}

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Venda":
      return "default";
    case "Check-in":
    case "Confirmado":
      return "secondary";
    case "Descartado":
    case "Opt Out":
    case "Desperdício":
      return "destructive";
    default:
      return "outline";
  }
};

export function RelatorioConvidadosTab({ empresaId, prospeccoes }: RelatorioConvidadosTabProps) {
  const { isEnabledForEmpresa } = useFeatureFlags();
  const [flagLoading, setFlagLoading] = useState(true);
  const [flagEnabled, setFlagEnabled] = useState(false);

  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [selectedProspeccao, setSelectedProspeccao] = useState<string>("__all__");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!empresaId) {
      setFlagLoading(false);
      setFlagEnabled(false);
      return;
    }
    setFlagLoading(true);
    isEnabledForEmpresa("relatorio_leads_convidados", empresaId)
      .then((enabled) => setFlagEnabled(enabled))
      .finally(() => setFlagLoading(false));
  }, [empresaId, isEnabledForEmpresa]);

  const fetchRelatorio = async () => {
    if (!empresaId) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const { data: rpcData, error } = await supabase.rpc("get_relatorio_convidados", {
        p_empresa_id: empresaId,
        p_date_start: dateStart ? new Date(dateStart).toISOString() : null,
        p_date_end: dateEnd ? new Date(`${dateEnd}T23:59:59`).toISOString() : null,
        p_prospeccao_ids:
          selectedProspeccao && selectedProspeccao !== "__all__" ? [selectedProspeccao] : null,
      });

      if (error) {
        console.error("Erro ao buscar relatório:", error);
        toast.error("Erro ao buscar relatório");
        setData([]);
      } else {
        setData((rpcData as RelatorioRow[]) || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar relatório");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = data.length;
    const byStatus: Record<string, number> = {};
    for (const row of data) {
      byStatus[row.status_atual] = (byStatus[row.status_atual] || 0) + 1;
    }
    return { total, byStatus };
  }, [data]);

  const exportCSV = () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const headers = [
      "Lead ID",
      "Nome",
      "Telefone",
      "Email",
      "Status Atual",
      "Data Convite",
      "Convidado Por",
      "Evento",
    ];
    const rows = data.map((r) => [
      r.lead_id ?? "",
      r.nome,
      r.telefone ?? "",
      r.email ?? "",
      r.status_atual,
      new Date(r.data_convite).toLocaleString("pt-BR"),
      r.convidado_por_nome ?? "Sistema",
      r.evento_nome ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_convidados_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso");
  };

  if (flagLoading) {
    return (
      <Card className="p-6 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!flagEnabled) {
    return (
      <Card className="p-8 text-center">
        <Lock className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Relatório não disponível</h3>
        <p className="text-sm text-muted-foreground">
          Esta funcionalidade não está ativa para sua loja. Entre em contato com a administração.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Relatório de Leads Convidados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="date-start">Data Início</Label>
            <Input
              id="date-start"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-end">Data Fim</Label>
            <Input
              id="date-end"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Evento</Label>
            <Select value={selectedProspeccao} onValueChange={setSelectedProspeccao}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os eventos</SelectItem>
                {prospeccoes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchRelatorio} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            <Button
              variant="outline"
              onClick={exportCSV}
              disabled={data.length === 0 || loading}
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {hasSearched && !loading && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total convidados</span>
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex flex-col">
                <span className="text-xs text-muted-foreground">{status}</span>
                <span className="text-2xl font-bold">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status Atual</TableHead>
                <TableHead>Data Convite</TableHead>
                <TableHead>Convidado Por</TableHead>
                <TableHead>Evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {hasSearched
                      ? "Nenhum lead convidado encontrado para os filtros aplicados."
                      : "Use os filtros acima e clique em Buscar para gerar o relatório."}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={`${row.contato_id}-${row.prospeccao_id}`}>
                    <TableCell className="font-mono text-xs">{row.lead_id ?? "-"}</TableCell>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    <TableCell>{row.telefone ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status_atual)}>
                        {row.status_atual}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(row.data_convite).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{row.convidado_por_nome ?? "Sistema"}</TableCell>
                    <TableCell>{row.evento_nome ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Download,
  Search,
  FileText,
  Loader2,
  Lock,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  eventos: string[] | null;
}

const statusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
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

// Reusable text-search column filter
function TextColumnFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0",
            value && "text-primary"
          )}
          aria-label="Filtrar coluna"
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center gap-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-sm"
            autoFocus
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Reusable multi-select column filter
function MultiSelectColumnFilter({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
    );
  };
  const isActive = selected.length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0", isActive && "text-primary")}
          aria-label={`Filtrar ${label}`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {selected.length} de {options.length}
          </span>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onChange([])}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <div className="max-h-[240px] overflow-y-auto space-y-0.5">
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-3">
              Nenhum valor disponível
            </div>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={checked} />
                  <span className="text-sm truncate flex-1">{opt}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RelatorioConvidadosTab({
  empresaId,
  prospeccoes,
}: RelatorioConvidadosTabProps) {
  const { isEnabledForEmpresa } = useFeatureFlags();
  const [flagLoading, setFlagLoading] = useState(true);
  const [flagEnabled, setFlagEnabled] = useState(false);

  // Global filters
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [selectedProspeccoes, setSelectedProspeccoes] = useState<string[]>([]);
  const [eventPopoverOpen, setEventPopoverOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Column filters (client-side)
  const [filterNome, setFilterNome] = useState("");
  const [filterTelefone, setFilterTelefone] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterConvidadoPor, setFilterConvidadoPor] = useState<string[]>([]);
  const [filterEventos, setFilterEventos] = useState("");

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
    // Reset column filters when refetching
    setFilterNome("");
    setFilterTelefone("");
    setFilterStatus([]);
    setFilterConvidadoPor([]);
    setFilterEventos("");
    try {
      const { data: rpcData, error } = await supabase.rpc(
        "get_relatorio_convidados",
        {
          p_empresa_id: empresaId,
          p_date_start: dateStart ? new Date(dateStart).toISOString() : null,
          p_date_end: dateEnd
            ? new Date(`${dateEnd}T23:59:59`).toISOString()
            : null,
          p_prospeccao_ids:
            selectedProspeccoes.length > 0 ? selectedProspeccoes : null,
        }
      );

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

  // Available options for multi-select column filters (derived from raw data)
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(data.map((r) => r.status_atual).filter(Boolean))).sort(),
    [data]
  );
  const convidadoPorOptions = useMemo(
    () =>
      Array.from(
        new Set(data.map((r) => r.convidado_por_nome ?? "Sistema"))
      ).sort(),
    [data]
  );

  // Filtered data (client-side column filters)
  const filteredData = useMemo(() => {
    const nomeQ = filterNome.trim().toLowerCase();
    const telQ = filterTelefone.trim().toLowerCase();
    const evQ = filterEventos.trim().toLowerCase();
    return data.filter((row) => {
      if (nomeQ && !row.nome.toLowerCase().includes(nomeQ)) return false;
      if (telQ && !(row.telefone ?? "").toLowerCase().includes(telQ))
        return false;
      if (filterStatus.length > 0 && !filterStatus.includes(row.status_atual))
        return false;
      if (filterConvidadoPor.length > 0) {
        const nm = row.convidado_por_nome ?? "Sistema";
        if (!filterConvidadoPor.includes(nm)) return false;
      }
      if (evQ) {
        const evs = (row.eventos ?? []).join(" ").toLowerCase();
        if (!evs.includes(evQ)) return false;
      }
      return true;
    });
  }, [data, filterNome, filterTelefone, filterStatus, filterConvidadoPor, filterEventos]);

  // Stats reflect filtered data
  const stats = useMemo(() => {
    const total = filteredData.length;
    const byStatus: Record<string, number> = {};
    for (const row of filteredData) {
      byStatus[row.status_atual] = (byStatus[row.status_atual] || 0) + 1;
    }
    return { total, byStatus };
  }, [filteredData]);

  const hasActiveColumnFilters =
    filterNome ||
    filterTelefone ||
    filterStatus.length > 0 ||
    filterConvidadoPor.length > 0 ||
    filterEventos;

  const clearColumnFilters = () => {
    setFilterNome("");
    setFilterTelefone("");
    setFilterStatus([]);
    setFilterConvidadoPor([]);
    setFilterEventos("");
  };

  const exportCSV = () => {
    if (filteredData.length === 0) {
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
      "Eventos",
    ];
    const rows = filteredData.map((r) => [
      r.lead_id ?? "",
      r.nome,
      r.telefone ?? "",
      r.email ?? "",
      r.status_atual,
      new Date(r.data_convite).toLocaleString("pt-BR"),
      r.convidado_por_nome ?? "Sistema",
      (r.eventos ?? []).join("; "),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_convidados_${new Date()
      .toISOString()
      .split("T")[0]}.csv`;
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
            <Label>Eventos</Label>
            <Popover open={eventPopoverOpen} onOpenChange={setEventPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">
                    {selectedProspeccoes.length === 0
                      ? "Todos os eventos"
                      : selectedProspeccoes.length === 1
                      ? prospeccoes.find((p) => p.id === selectedProspeccoes[0])?.titulo ?? "1 evento"
                      : `${selectedProspeccoes.length} eventos selecionados`}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-2" align="start">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedProspeccoes.length} de {prospeccoes.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedProspeccoes(prospeccoes.map((p) => p.id))}
                    >
                      Todos
                    </Button>
                    {selectedProspeccoes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setSelectedProspeccoes([])}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[280px] overflow-y-auto space-y-0.5">
                  {prospeccoes.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Nenhum evento disponível
                    </div>
                  ) : (
                    prospeccoes.map((p) => {
                      const isSelected = selectedProspeccoes.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          onClick={() =>
                            setSelectedProspeccoes((prev) =>
                              isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate flex-1">{p.titulo}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
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
              disabled={filteredData.length === 0 || loading}
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {hasSearched && !loading && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {hasActiveColumnFilters ? "Total filtrado" : "Total convidados"}
                </span>
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{status}</span>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              ))}
            </div>
            {hasActiveColumnFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearColumnFilters}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpar filtros de coluna
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Nome
                    <TextColumnFilter
                      value={filterNome}
                      onChange={setFilterNome}
                      placeholder="Buscar nome..."
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Telefone
                    <TextColumnFilter
                      value={filterTelefone}
                      onChange={setFilterTelefone}
                      placeholder="Buscar telefone..."
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Status Atual
                    <MultiSelectColumnFilter
                      options={statusOptions}
                      selected={filterStatus}
                      onChange={setFilterStatus}
                      label="status"
                    />
                  </div>
                </TableHead>
                <TableHead>Data Convite</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Convidado Por
                    <MultiSelectColumnFilter
                      options={convidadoPorOptions}
                      selected={filterConvidadoPor}
                      onChange={setFilterConvidadoPor}
                      label="convidado por"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Eventos
                    <TextColumnFilter
                      value={filterEventos}
                      onChange={setFilterEventos}
                      placeholder="Buscar evento..."
                    />
                  </div>
                </TableHead>
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
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {hasSearched
                      ? hasActiveColumnFilters
                        ? "Nenhum resultado para os filtros de coluna aplicados."
                        : "Nenhum lead convidado encontrado para os filtros aplicados."
                      : "Use os filtros acima e clique em Buscar para gerar o relatório."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row) => (
                  <TableRow key={row.contato_id}>
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
                    <TableCell>
                      {row.eventos && row.eventos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.eventos.map((ev) => (
                            <Badge key={ev} variant="outline" className="text-xs font-normal">
                              {ev}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
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

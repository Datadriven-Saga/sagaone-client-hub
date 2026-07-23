import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Search, X, RefreshCcw, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { statusBadgeClass, STATUS_ORDER, useDiagnosticoEventos } from "@/hooks/useDiagnosticoEventos";

const PAGE_SIZE = 50;

interface LeadDivergente {
  contato_id: string;
  contato_nome: string | null;
  telefone: string | null;
  empresa_id: string;
  loja_nome: string | null;
  prospeccao_id: string;
  evento_titulo: string;
  evento_data_fim: string | null;
  evento_encerrado_at: string | null;
  status_atual: string | null;
  status_esperado: string | null;
  status_anterior: string | null;
  responsavel_atual: string | null;
  responsavel_no_log: string | null;
  ultima_observacao: string | null;
  ultima_alteracao: string | null;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  width = 220,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between" style={{ minWidth: width }}>
          <span className="truncate">
            {selected.length === 0
              ? label
              : `${label}: ${selected.length} ${selected.length === 1 ? "selecionado" : "selecionados"}`}
          </span>
          {selected.length > 0 && (
            <X
              className="h-3 w-3 ml-2 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    onSelect={() => onChange(checked ? selected.filter((s) => s !== o.id) : [...selected, o.id])}
                  >
                    <Checkbox checked={checked} className="mr-2" />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DiagnosticoStatus() {
  const { opcoes } = useDiagnosticoEventos();
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [prospeccaoIds, setProspeccaoIds] = useState<string[]>([]);
  const [statusAtual, setStatusAtual] = useState<string[]>([]);
  const [statusEsperado, setStatusEsperado] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeadDivergente[]>([]);
  const [total, setTotal] = useState(0);
  const [porLoja, setPorLoja] = useState<{ empresa_id: string; loja_nome: string; total: number }[]>([]);

  const empresasOptions = useMemo(
    () => (opcoes?.empresas ?? []).map((e) => ({ id: e.id, label: e.nome })),
    [opcoes],
  );
  const prospeccoesOptions = useMemo(
    () => (opcoes?.prospeccoes ?? [])
      .filter((p) => empresaIds.length === 0 || empresaIds.includes(p.empresa_id))
      .map((p) => ({ id: p.id, label: p.titulo })),
    [opcoes, empresaIds],
  );
  const statusOptions = useMemo(
    () => STATUS_ORDER.map((s) => ({ id: s, label: s })),
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_leads_status_divergente", {
      p_empresa_ids: empresaIds.length ? empresaIds : null,
      p_prospeccao_ids: prospeccaoIds.length ? prospeccaoIds : null,
      p_status_atual: statusAtual.length ? statusAtual : null,
      p_status_esperado: statusEsperado.length ? statusEsperado : null,
      p_search: search || null,
      p_data_de: dataDe ? new Date(dataDe).toISOString() : null,
      p_data_ate: dataAte ? new Date(dataAte + "T23:59:59").toISOString() : null,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar divergências: " + error.message);
      return;
    }
    setRows((data?.rows ?? []) as LeadDivergente[]);
    setTotal(data?.total ?? 0);
    setPorLoja((data?.por_loja ?? []) as any);
  }, [empresaIds, prospeccaoIds, statusAtual, statusEsperado, search, dataDe, dataAte, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsByLoja = useMemo(() => {
    const map = new Map<string, LeadDivergente[]>();
    for (const r of rows) {
      const key = r.loja_nome ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const exportCsv = () => {
    const header = ["Loja","Evento","Contato","Telefone","Status atual","Status esperado","Responsável atual","Responsável no log","Última alteração","Observação"];
    const lines = rows.map((r) => [
      r.loja_nome ?? "",
      r.evento_titulo,
      r.contato_nome ?? "",
      r.telefone ?? "",
      r.status_atual ?? "",
      r.status_esperado ?? "",
      r.responsavel_atual ?? "",
      r.responsavel_no_log ?? "",
      r.ultima_alteracao ? format(new Date(r.ultima_alteracao), "dd/MM/yyyy HH:mm") : "",
      (r.ultima_observacao ?? "").replace(/\s+/g, " "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-status-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setEmpresaIds([]); setProspeccaoIds([]); setStatusAtual([]); setStatusEsperado([]);
    setSearch(""); setDataDe(""); setDataAte(""); setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-6 w-6" /> Diagnóstico de Status
            </h1>
            <p className="text-sm text-muted-foreground">
              Leads em que o status atual do contato diverge do último status registrado no histórico de movimentações.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setPage(1); fetchData(); }}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <MultiSelectFilter label="Lojas" options={empresasOptions} selected={empresaIds} onChange={(v) => { setEmpresaIds(v); setPage(1); }} />
              <MultiSelectFilter label="Eventos" options={prospeccoesOptions} selected={prospeccaoIds} onChange={(v) => { setProspeccaoIds(v); setPage(1); }} />
              <MultiSelectFilter label="Status atual" options={statusOptions} selected={statusAtual} onChange={(v) => { setStatusAtual(v); setPage(1); }} />
              <MultiSelectFilter label="Status esperado" options={statusOptions} selected={statusEsperado} onChange={(v) => { setStatusEsperado(v); setPage(1); }} />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">De</span>
                <Input type="date" value={dataDe} onChange={(e) => { setDataDe(e.target.value); setPage(1); }} className="h-8 w-[140px]" />
                <span className="text-xs text-muted-foreground">Até</span>
                <Input type="date" value={dataAte} onChange={(e) => { setDataAte(e.target.value); setPage(1); }} className="h-8 w-[140px]" />
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchData(); } }}
                  className="h-8 pl-8"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Divergências por loja</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {porLoja.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma divergência com os filtros atuais.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {porLoja.map((l) => (
                  <Badge key={l.empresa_id} variant="outline" className="cursor-pointer" onClick={() => { setEmpresaIds([l.empresa_id]); setPage(1); }}>
                    {l.loja_nome} — {l.total}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {loading ? "Carregando..." : `${total.toLocaleString("pt-BR")} leads divergentes`}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rowsByLoja.map(([loja, items]) => (
              <div key={loja} className="border-t">
                <div className="px-4 py-2 bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
                  {loja} · {items.length}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status atual</TableHead>
                      <TableHead>Status esperado</TableHead>
                      <TableHead>Responsável atual</TableHead>
                      <TableHead>Responsável no log</TableHead>
                      <TableHead>Última alteração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r) => (
                      <TableRow key={`${r.contato_id}-${r.prospeccao_id}`}>
                        <TableCell>
                          <div className="font-medium">{r.contato_nome || "Lead sem nome"}</div>
                          <div className="text-xs text-muted-foreground">{r.telefone}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.evento_titulo}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(r.status_atual ?? "")}>{r.status_atual ?? "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(r.status_esperado ?? "")}>{r.status_esperado ?? "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.responsavel_atual || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">{r.responsavel_no_log || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.ultima_alteracao ? format(new Date(r.ultima_alteracao), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lead divergente encontrado.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
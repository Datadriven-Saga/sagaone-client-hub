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
import { Activity, Search, X, RefreshCcw, ChevronLeft, ChevronRight, Download, Wrench, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { statusBadgeClass, STATUS_ORDER } from "@/hooks/useDiagnosticoEventos";

const PAGE_SIZE = 50;

function idsOrNull(selected: string[], options: { id: string }[]) {
  if (selected.length === 0 || (options.length > 0 && selected.length === options.length)) {
    return null;
  }
  return selected;
}

function hasSpecificSelection(selected: string[], options: { id: string }[]) {
  return selected.length > 0 && selected.length < options.length;
}

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
  responsavel_atual_email: string | null;
  responsavel_atual_nome: string | null;
  responsavel_no_log: string | null;
  responsavel_email_no_log: string | null;
  tem_responsavel: boolean;
  ultima_observacao: string | null;
  ultima_alteracao: string | null;
}

interface DiagnosticoStatusOpcoes {
  empresas: { id: string; nome: string; marca?: string | null; uf?: string | null }[];
  prospeccoes: {
    id: string;
    titulo: string;
    empresa_id: string;
    loja_nome?: string | null;
    data_inicio?: string | null;
    data_fim: string | null;
    encerrado_at: string | null;
    ativo?: boolean | null;
    event_id_pri?: string | null;
  }[];
  statuses?: string[];
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  width = 220,
  toggleSelectAll = false,
  wrapLabels = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  width?: number;
  toggleSelectAll?: boolean;
  wrapLabels?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === options.length && options.length > 0;
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
              {toggleSelectAll ? (
                <CommandItem
                  onSelect={() => onChange(allSelected ? [] : options.map((o) => o.id))}
                  className="text-xs font-medium"
                >
                  <Checkbox checked={allSelected} className="mr-2" />
                  {allSelected ? "Limpar seleção" : "Selecionar todos"}
                </CommandItem>
              ) : (
                <>
                  <CommandItem
                    onSelect={() => onChange(options.map((o) => o.id))}
                    className="text-xs font-medium"
                  >
                    <Checkbox checked={allSelected} className="mr-2" />
                    Selecionar todos
                  </CommandItem>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="text-xs text-muted-foreground"
                  >
                    <Checkbox checked={false} className="mr-2" />
                    Limpar seleção
                  </CommandItem>
                </>
              )}
              <div className="h-px bg-border my-1" />
              {options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    onSelect={() => onChange(checked ? selected.filter((s) => s !== o.id) : [...selected, o.id])}
                  >
                    <Checkbox checked={checked} className="mr-2" />
                    <span className={wrapLabels ? "whitespace-normal break-words leading-snug" : "truncate"}>{o.label}</span>
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
  const [opcoes, setOpcoes] = useState<DiagnosticoStatusOpcoes | null>(null);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [prospeccaoIds, setProspeccaoIds] = useState<string[]>([]);
  const [statusAtual, setStatusAtual] = useState<string[]>([]);
  const [statusEsperado, setStatusEsperado] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeadDivergente[]>([]);
  const [total, setTotal] = useState(0);
  const [porLoja, setPorLoja] = useState<{ empresa_id: string; loja_nome: string; total: number }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [tipoAcessoAlvo, setTipoAcessoAlvo] = useState<"Vendedor" | "SDR" | "Ambos">("Vendedor");
  const [restoreProgress, setRestoreProgress] = useState<{ loja: string; atual: number; total: number } | null>(null);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);

  const loadOpcoes = useCallback(async () => {
    setLoadingOpcoes(true);
    const { data, error } = await (supabase as any).rpc("get_diagnostico_status_filtros");
    setLoadingOpcoes(false);

    if (error) {
      toast.error("Falha ao carregar filtros: " + error.message);
      return;
    }

    setOpcoes(data as DiagnosticoStatusOpcoes);
  }, []);

  const empresasOptions = useMemo(
    () => (opcoes?.empresas ?? []).map((e) => ({ id: e.id, label: e.nome })),
    [opcoes],
  );
  const prospeccoesOptions = useMemo(
    () => (opcoes?.prospeccoes ?? [])
      .filter((p) => empresaIds.length === 0 || empresaIds.includes(p.empresa_id))
      .map((p) => ({
        id: p.id,
        label: [p.titulo, p.loja_nome].filter(Boolean).join(" · "),
      })),
    [opcoes, empresaIds],
  );
  const statusOptions = useMemo(
    () => (opcoes?.statuses?.length ? opcoes.statuses : [...STATUS_ORDER]).map((s) => ({ id: s, label: s })),
    [opcoes],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const selectedEmpresaIds = idsOrNull(empresaIds, empresasOptions);
    const selectedProspeccaoIds = idsOrNull(prospeccaoIds, prospeccoesOptions);
    const selectedStatusAtual = idsOrNull(statusAtual, statusOptions);
    const selectedStatusEsperado = idsOrNull(statusEsperado, statusOptions);

    const hasScopedFilter =
      hasSpecificSelection(empresaIds, empresasOptions) ||
      hasSpecificSelection(prospeccaoIds, prospeccoesOptions) ||
      Boolean(search.trim()) ||
      hasSpecificSelection(statusAtual, statusOptions) ||
      hasSpecificSelection(statusEsperado, statusOptions);

    if (!hasScopedFilter) {
      setRows([]);
      setTotal(0);
      setPorLoja([]);
      setLoading(false);
      return;
    }

    const { data, error } = await (supabase as any).rpc("get_leads_status_divergente", {
      p_empresa_ids: selectedEmpresaIds,
      p_prospeccao_ids: selectedProspeccaoIds,
      p_status_atual: selectedStatusAtual,
      p_status_esperado: selectedStatusEsperado,
      p_search: search || null,
      p_data_de: null,
      p_data_ate: null,
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
  }, [empresaIds, empresasOptions, prospeccaoIds, prospeccoesOptions, statusAtual, statusEsperado, statusOptions, search, page]);

  useEffect(() => { loadOpcoes(); }, [loadOpcoes]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isGlobalQuery =
    !hasSpecificSelection(empresaIds, empresasOptions) &&
    !hasSpecificSelection(prospeccaoIds, prospeccoesOptions) &&
    !hasSpecificSelection(statusAtual, statusOptions) &&
    !hasSpecificSelection(statusEsperado, statusOptions) &&
    !search.trim();

  const rowsByLoja = useMemo(() => {
    const map = new Map<string, LeadDivergente[]>();
    for (const r of rows) {
      const key = r.loja_nome ?? "—";
      const current = map.get(key) ?? [];
      current.push(r);
      map.set(key, current);
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
      [r.responsavel_no_log, r.responsavel_email_no_log].filter(Boolean).join(" · "),
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
    setSearch(""); setPage(1);
  };

  const selectedLojaId = empresaIds.length === 1 ? empresaIds[0] : null;
  const selectedLojaNome = selectedLojaId
    ? empresasOptions.find((e) => e.id === selectedLojaId)?.label ?? ""
    : "";

  const tiposArray = useMemo<string[]>(
    () => (tipoAcessoAlvo === "Ambos" ? ["Vendedor", "SDR"] : [tipoAcessoAlvo]),
    [tipoAcessoAlvo],
  );

  // Lojas alvo: se 1 selecionada usa ela; se nada ou tudo selecionado usa todas;
  // caso contrário usa a seleção específica.
  const lojasAlvoRestauracao = useMemo(() => {
    const all = opcoes?.empresas ?? [];
    if (empresaIds.length === 0 || empresaIds.length === all.length) {
      return all.map((e) => ({ id: e.id, nome: e.nome }));
    }
    return all.filter((e) => empresaIds.includes(e.id)).map((e) => ({ id: e.id, nome: e.nome }));
  }, [opcoes, empresaIds]);

  const podeRestaurar = lojasAlvoRestauracao.length > 0;

  const openPreview = async () => {
    if (!podeRestaurar) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    // Preview: se 1 loja, chama; se várias, agrega
    let agg = { total_divergentes: 0, elegiveis: 0, descartados_outros_perfis: 0, descartados_sem_perfil: 0 } as any;
    let amostra: any[] = [];
    for (const loja of lojasAlvoRestauracao.slice(0, 50)) {
      const { data, error } = await (supabase as any).rpc("preview_restauracao_por_perfil", {
        p_empresa_id: loja.id,
        p_tipo_acesso: tiposArray,
      });
      if (error) continue;
      agg.total_divergentes += Number(data?.total_divergentes ?? 0);
      agg.elegiveis += Number(data?.elegiveis ?? 0);
      agg.descartados_outros_perfis += Number(data?.descartados_outros_perfis ?? 0);
      agg.descartados_sem_perfil += Number(data?.descartados_sem_perfil ?? 0);
      if (amostra.length < 20 && Array.isArray(data?.amostra)) {
        amostra = amostra.concat(data.amostra).slice(0, 20);
      }
    }
    agg.amostra = amostra;
    agg.total_lojas = lojasAlvoRestauracao.length;
    setPreviewLoading(false);
    setPreviewData(agg);
  };

  const runRestore = async () => {
    if (!podeRestaurar) return;
    setRestoring(true);
    let totalRestaurados = 0;
    let totalLojasOk = 0;
    let totalLojasErro = 0;
    try {
      for (let idx = 0; idx < lojasAlvoRestauracao.length; idx++) {
        const loja = lojasAlvoRestauracao[idx];
        setRestoreProgress({ loja: loja.nome, atual: idx + 1, total: lojasAlvoRestauracao.length });
        let restauradosLoja = 0;
        let batchIdx = 0;
        let deuErro = false;
        // Batches por loja
        for (let i = 0; i < 200; i++) {
          const t0 = Date.now();
          const { data, error } = await (supabase as any).rpc("restore_leads_por_perfil", {
            p_empresa_id: loja.id,
            p_tipo_acesso: tiposArray,
            p_dry_run: false,
            p_limit: 500,
          });
          const dur = Date.now() - t0;
          if (error) {
            deuErro = true;
            await (supabase as any).from("restauracao_status_auditoria").insert({
              empresa_id: loja.id,
              loja_nome: loja.nome,
              tipo_acesso_alvo: tiposArray,
              batch_index: batchIdx,
              processados: 0,
              atualizados: 0,
              status: "erro",
              erro_mensagem: error.message ?? String(error),
              erro_codigo: (error as any).code ?? null,
              duracao_ms: dur,
            });
            break;
          }
          const upd = Number(data?.atualizados ?? 0);
          const proc = Number(data?.processados ?? upd);
          restauradosLoja += upd;
          await (supabase as any).from("restauracao_status_auditoria").insert({
            empresa_id: loja.id,
            loja_nome: loja.nome,
            tipo_acesso_alvo: tiposArray,
            batch_index: batchIdx,
            processados: proc,
            atualizados: upd,
            status: "sucesso",
            amostra: data?.amostra ?? null,
            duracao_ms: dur,
          });
          batchIdx++;
          if (proc < 500) break;
        }
        if (deuErro) totalLojasErro++; else totalLojasOk++;
        totalRestaurados += restauradosLoja;
      }
      toast.success(
        `Restauração concluída: ${totalRestaurados} lead(s) em ${totalLojasOk} loja(s).` +
          (totalLojasErro ? ` ${totalLojasErro} loja(s) com erro — verifique a auditoria.` : ""),
      );
      setPreviewOpen(false);
      setPage(1);
      fetchData();
    } catch (err: any) {
      toast.error("Falha na restauração: " + (err?.message ?? String(err)));
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  const loadAuditoria = async () => {
    setAuditoriaOpen(true);
    setAuditoriaLoading(true);
    const { data, error } = await (supabase as any)
      .from("restauracao_status_auditoria")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setAuditoriaLoading(false);
    if (error) { toast.error("Falha ao carregar auditoria: " + error.message); return; }
    setAuditoria(data ?? []);
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
            <Button
              variant="default"
              size="sm"
              disabled={!podeRestaurar}
              onClick={openPreview}
              title={podeRestaurar
                ? `Restaurar ${lojasAlvoRestauracao.length} loja(s) · ${tipoAcessoAlvo}`
                : "Selecione ao menos 1 loja (ou deixe todas)"}
            >
              <Wrench className="h-4 w-4 mr-2" /> Restaurar ({tipoAcessoAlvo})
            </Button>
            <Button variant="outline" size="sm" onClick={loadAuditoria}>
              <History className="h-4 w-4 mr-2" /> Auditoria
            </Button>
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
              <MultiSelectFilter label={loadingOpcoes ? "Carregando lojas..." : "Lojas"} options={empresasOptions} selected={empresaIds} onChange={(v) => { setEmpresaIds(v); setProspeccaoIds((ids) => ids.filter((id) => (opcoes?.prospeccoes ?? []).some((p) => p.id === id && (v.length === 0 || v.includes(p.empresa_id))))); setPage(1); }} toggleSelectAll width={240} />
              <MultiSelectFilter label="Eventos" options={prospeccoesOptions} selected={prospeccaoIds} onChange={(v) => { setProspeccaoIds(v); setPage(1); }} toggleSelectAll wrapLabels width={260} />
              <MultiSelectFilter label="Status atual" options={statusOptions} selected={statusAtual} onChange={(v) => { setStatusAtual(v); setPage(1); }} />
              <MultiSelectFilter label="Status esperado" options={statusOptions} selected={statusEsperado} onChange={(v) => { setStatusEsperado(v); setPage(1); }} />
              <Select value={tipoAcessoAlvo} onValueChange={(v: any) => setTipoAcessoAlvo(v)}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Tipo de acesso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vendedor">Tipo: Vendedor</SelectItem>
                  <SelectItem value="SDR">Tipo: SDR</SelectItem>
                  <SelectItem value="Ambos">Tipo: Vendedor + SDR</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, telefone, evento ou responsável..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchData(); } }}
                  className="h-8 pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Divergências por loja</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {porLoja.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isGlobalQuery
                  ? "Selecione uma loja, evento, status, período ou busca para carregar os totais."
                  : "Nenhuma divergência com os filtros atuais."}
              </p>
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
                        <TableCell className="text-xs">
                          <div>{r.evento_titulo}</div>
                          {r.evento_data_fim && <div className="text-muted-foreground">Fim: {format(new Date(`${r.evento_data_fim}T00:00:00`), "dd/MM/yyyy")}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(r.status_atual ?? "")}>{r.status_atual ?? "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(r.status_esperado ?? "")}>{r.status_esperado ?? "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.tem_responsavel ? (
                            <div>
                              <div>{r.responsavel_atual_nome || r.responsavel_atual || "—"}</div>
                              {r.responsavel_atual_email && <div className="text-muted-foreground">{r.responsavel_atual_email}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Sem responsável</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.responsavel_no_log || r.responsavel_email_no_log ? (
                            <div>
                              <div>{r.responsavel_no_log || "—"}</div>
                              {r.responsavel_email_no_log && <div className="text-muted-foreground">{r.responsavel_email_no_log}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                {isGlobalQuery
                  ? "A consulta sem recorte foi bloqueada para evitar timeout. Use pelo menos um filtro específico."
                  : "Nenhum lead divergente encontrado."}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Restaurar leads — {lojasAlvoRestauracao.length === 1
                  ? lojasAlvoRestauracao[0].nome
                  : `${lojasAlvoRestauracao.length} loja(s)`} · {tipoAcessoAlvo}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {previewLoading && <p>Calculando…</p>}
                  {!previewLoading && previewData && (
                    <>
                      <p>
                        Serão restaurados apenas leads cujo último log válido aponta para um usuário com acesso{" "}
                        <strong>{tiposArray.join(" ou ")}</strong>. A execução é feita <strong>loja a loja</strong>,
                        em lotes de 500, até finalizar cada uma antes de passar para a próxima.
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Lojas alvo: <strong>{previewData.total_lojas ?? lojasAlvoRestauracao.length}</strong></li>
                        <li>Total divergentes: <strong>{previewData.total_divergentes ?? 0}</strong></li>
                        <li>Elegíveis ({tiposArray.join("+")}): <strong className="text-primary">{previewData.elegiveis ?? 0}</strong></li>
                        <li>Descartados — outros perfis: {previewData.descartados_outros_perfis ?? 0}</li>
                        <li>Descartados — sem perfil vinculado: {previewData.descartados_sem_perfil ?? 0}</li>
                      </ul>
                      {restoreProgress && (
                        <p className="text-xs">
                          Em execução: <strong>{restoreProgress.loja}</strong> ({restoreProgress.atual}/{restoreProgress.total})
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Cada lote registra auditoria em <code>restauracao_status_auditoria</code> (sucesso/erro).
                      </p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={restoring || previewLoading || !previewData || (previewData?.elegiveis ?? 0) === 0}
                onClick={(e) => { e.preventDefault(); runRestore(); }}
              >
                {restoring ? "Restaurando…" : `Restaurar ${previewData?.elegiveis ?? 0} lead(s)`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={auditoriaOpen} onOpenChange={setAuditoriaOpen}>
          <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Auditoria de restaurações</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-xs text-muted-foreground">
                  Últimos 200 lotes executados. Erros exibem o motivo.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              {auditoriaLoading ? (
                <p className="p-4 text-sm">Carregando…</p>
              ) : auditoria.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Sem registros.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Proc.</TableHead>
                      <TableHead>Atual.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditoria.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(a.created_at), "dd/MM HH:mm:ss")}</TableCell>
                        <TableCell className="text-xs">{a.loja_nome ?? a.empresa_id?.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs">{Array.isArray(a.tipo_acesso_alvo) ? a.tipo_acesso_alvo.join("+") : "—"}</TableCell>
                        <TableCell className="text-xs">{a.batch_index}</TableCell>
                        <TableCell className="text-xs">{a.processados}</TableCell>
                        <TableCell className="text-xs font-medium">{a.atualizados}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "sucesso" ? "outline" : "destructive"}>{a.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate" title={a.erro_mensagem ?? ""}>
                          {a.erro_mensagem ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
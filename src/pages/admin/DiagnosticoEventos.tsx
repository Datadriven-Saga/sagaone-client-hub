import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, Users, Building2, ClipboardList, AlertTriangle, CalendarClock, RefreshCcw, UserPlus, CalendarDays, Ban, Search, X } from "lucide-react";
import { useDiagnosticoEventos, statusBadgeClass, STATUS_ORDER, useMultiSelect, type DiagnosticoFiltros, type DiagnosticoLead } from "@/hooks/useDiagnosticoEventos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAGE_SIZE = 25;

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options.filter((o) => selected.includes(o.id)).slice(0, 2).map((o) => o.label);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between min-w-[180px]">
          <span className="truncate">
            {selected.length === 0
              ? label
              : selected.length <= 2
              ? `${label}: ${selectedLabels.join(", ")}`
              : `${label}: ${selected.length} selecionados`}
          </span>
          {selected.length > 0 && (
            <X
              className="h-3 w-3 ml-2 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
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
                    onSelect={() => {
                      onChange(checked ? selected.filter((s) => s !== o.id) : [...selected, o.id]);
                    }}
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

function KpiCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: number | string; hint?: string; tone?: "default" | "warning" | "success" }) {
  const toneCls = tone === "warning" ? "border-amber-200 dark:border-amber-900" : tone === "success" ? "border-emerald-200 dark:border-emerald-900" : "";
  return (
    <Card className={toneCls}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function DiagnosticoEventos() {
  const { opcoes, kpis, leads, total, loadingKpis, loadingLeads, fetchKpis, fetchLeads } = useDiagnosticoEventos();

  const [filtros, setFiltros] = useState<DiagnosticoFiltros>({
    terceiro_ids: [],
    empresa_ids: [],
    prospeccao_ids: [],
    seat_ids: [],
    data_de: null,
    data_ate: null,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { selected, toggle, clear, list: selectedList } = useMultiSelect<string>();

  // Modais
  const [reatribuirOpen, setReatribuirOpen] = useState(false);
  const [dataFimOpen, setDataFimOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [encerrarProspId, setEncerrarProspId] = useState<string | null>(null);

  const empresaOptions = useMemo(
    () => (opcoes?.empresas ?? []).map((e) => ({ id: e.id, label: e.nome })),
    [opcoes],
  );
  const eventoOptions = useMemo(
    () =>
      (opcoes?.prospeccoes ?? [])
        .filter((p) => !filtros.empresa_ids?.length || filtros.empresa_ids.includes(p.empresa_id))
        .map((p) => ({
          id: p.id,
          label: `${p.titulo}${p.data_fim ? " — " + format(new Date(p.data_fim), "dd/MM/yy") : ""}`,
        })),
    [opcoes, filtros.empresa_ids],
  );
  const terceiroOptions = useMemo(
    () => (opcoes?.terceiros ?? []).map((t) => ({ id: t.id, label: t.nome })),
    [opcoes],
  );
  const seatOptions = useMemo(() => {
    const empresas = new Map((opcoes?.empresas ?? []).map((e) => [e.id, e.nome]));
    const prosp = new Map((opcoes?.prospeccoes ?? []).map((p) => [p.id, p.titulo]));
    return (opcoes?.seats ?? []).map((s) => ({
      id: s.id,
      label: `${empresas.get(s.empresa_id) ?? "?"} — ${prosp.get(s.prospeccao_id) ?? "?"}`,
    }));
  }, [opcoes]);

  const refresh = () => {
    fetchKpis(filtros);
    fetchLeads(filtros, page, PAGE_SIZE, search);
  };

  useEffect(() => {
    fetchKpis(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtros)]);

  useEffect(() => {
    fetchLeads(filtros, page, PAGE_SIZE, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtros), page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchLeads(filtros, 1, PAGE_SIZE, search);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectedLeads = leads.filter((l) => selected.has(`${l.contato_id}::${l.prospeccao_id}`));
  const selectedProspIds = Array.from(new Set(selectedLeads.map((l) => l.prospeccao_id)));

  const clearFilters = () =>
    setFiltros({ terceiro_ids: [], empresa_ids: [], prospeccao_ids: [], seat_ids: [], data_de: null, data_ate: null });

  const filterActive =
    (filtros.terceiro_ids?.length ?? 0) +
      (filtros.empresa_ids?.length ?? 0) +
      (filtros.prospeccao_ids?.length ?? 0) +
      (filtros.seat_ids?.length ?? 0) >
      0 || !!filtros.data_de || !!filtros.data_ate;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="h1 flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Diagnóstico de Eventos
            </h1>
            <p className="text-muted-foreground">Visão gerencial dos eventos, leads e responsáveis com ações em lote</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Loja"
              options={empresaOptions}
              selected={filtros.empresa_ids ?? []}
              onChange={(ids) => setFiltros((f) => ({ ...f, empresa_ids: ids, prospeccao_ids: [], seat_ids: [] }))}
            />
            <MultiSelectFilter
              label="Evento"
              options={eventoOptions}
              selected={filtros.prospeccao_ids ?? []}
              onChange={(ids) => setFiltros((f) => ({ ...f, prospeccao_ids: ids }))}
            />
            <MultiSelectFilter
              label="Usuário terceiro"
              options={terceiroOptions}
              selected={filtros.terceiro_ids ?? []}
              onChange={(ids) => setFiltros((f) => ({ ...f, terceiro_ids: ids }))}
            />
            <MultiSelectFilter
              label="Cadeira"
              options={seatOptions}
              selected={filtros.seat_ids ?? []}
              onChange={(ids) => setFiltros((f) => ({ ...f, seat_ids: ids }))}
            />
            <Input
              type="date"
              value={filtros.data_de ?? ""}
              onChange={(e) => setFiltros((f) => ({ ...f, data_de: e.target.value || null }))}
              className="w-[150px] [color-scheme:light] dark:[color-scheme:dark]"
              placeholder="Data de"
            />
            <Input
              type="date"
              value={filtros.data_ate ?? ""}
              onChange={(e) => setFiltros((f) => ({ ...f, data_ate: e.target.value || null }))}
              className="w-[150px] [color-scheme:light] dark:[color-scheme:dark]"
              placeholder="Data até"
            />
            {filterActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard icon={ClipboardList} label="Total de leads" value={loadingKpis ? "—" : kpis?.total_leads ?? 0} />
          <KpiCard icon={CalendarClock} label="Eventos ativos" value={loadingKpis ? "—" : kpis?.eventos_ativos ?? 0} hint={`${kpis?.eventos_total ?? 0} totais`} />
          <KpiCard icon={Users} label="Atribuídos" value={loadingKpis ? "—" : kpis?.leads_atribuidos ?? 0} />
          <KpiCard icon={UserPlus} label="Não atribuídos" value={loadingKpis ? "—" : kpis?.leads_nao_atribuidos ?? 0} />
          <KpiCard icon={Building2} label="Leads / loja" value={loadingKpis ? "—" : kpis?.leads_por_loja ?? 0} hint={`${kpis?.lojas_count ?? 0} lojas`} />
          <KpiCard
            icon={AlertTriangle}
            label="Eventos expirados"
            value={loadingKpis ? "—" : kpis?.eventos_expirados ?? 0}
            hint={`${kpis?.eventos_expirados_leads_pendentes ?? 0} leads pendentes`}
            tone="warning"
          />
        </div>

        {/* Status breakdown */}
        {kpis && kpis.total_leads > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição por status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {STATUS_ORDER.map((s) => {
                  const v = kpis.status_breakdown?.[s] ?? 0;
                  const pct = kpis.total_leads > 0 ? (v / kpis.total_leads) * 100 : 0;
                  if (pct === 0) return null;
                  return <div key={s} className={statusBadgeClass(s).split(" ")[0].replace("bg-", "bg-") + " h-full"} style={{ width: `${pct}%` }} title={`${s}: ${v}`} />;
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {STATUS_ORDER.map((s) => {
                  const v = kpis.status_breakdown?.[s] ?? 0;
                  return (
                    <Badge key={s} variant="outline" className={`${statusBadgeClass(s)} border-0`}>
                      {s}: {v}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {kpis && kpis.eventos_expirados_leads_pendentes > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Há eventos expirados com leads pendentes</AlertTitle>
            <AlertDescription>
              {kpis.eventos_expirados_leads_pendentes} lead(s) em {kpis.eventos_expirados} evento(s) expirado(s). Considere encerrar os eventos abaixo.
            </AlertDescription>
          </Alert>
        )}

        {/* Ações em lote */}
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[260px]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedList.length > 0 ? `${selectedList.length} selecionado(s)` : `${total} leads`}
              </span>
              <Button size="sm" variant="outline" disabled={selectedList.length === 0} onClick={() => setReatribuirOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Reatribuir
              </Button>
              <Button size="sm" variant="outline" disabled={selectedProspIds.length === 0} onClick={() => setDataFimOpen(true)}>
                <CalendarDays className="h-4 w-4 mr-1" /> Alterar data final
              </Button>
              <Button size="sm" variant="destructive" disabled={selectedProspIds.length !== 1} onClick={() => { setEncerrarProspId(selectedProspIds[0]); setEncerrarOpen(true); }}>
                <Ban className="h-4 w-4 mr-1" /> Encerrar evento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={leads.length > 0 && leads.every((l) => selected.has(`${l.contato_id}::${l.prospeccao_id}`))}
                      onCheckedChange={(v) => {
                        if (v) {
                          leads.forEach((l) => {
                            const k = `${l.contato_id}::${l.prospeccao_id}`;
                            if (!selected.has(k)) toggle(k);
                          });
                        } else {
                          clear();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado com os filtros aplicados.</TableCell></TableRow>
                ) : (
                  leads.map((l) => {
                    const key = `${l.contato_id}::${l.prospeccao_id}`;
                    const expirado = l.encerrado_at ? false : (l.data_fim && new Date(l.data_fim) < new Date(new Date().toDateString()));
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{l.nome || "Lead sem nome"}</div>
                          <div className="text-xs text-muted-foreground">{l.telefone}</div>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="truncate">{l.evento_titulo}</div>
                          {l.encerrado_at && <Badge variant="outline" className="mt-1 text-[10px]">Encerrado</Badge>}
                          {expirado && !l.encerrado_at && <Badge variant="destructive" className="mt-1 text-[10px]">Expirado</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{l.loja_nome ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {l.responsavel_nome ?? <span className="text-muted-foreground italic">Não atribuído</span>}
                        </TableCell>
                        <TableCell><Badge className={`${statusBadgeClass(l.status_evento)} border-0`}>{l.status_evento}</Badge></TableCell>
                        <TableCell className="text-sm">{l.data_fim ? format(new Date(l.data_fim), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Paginação */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))} — {total} lead(s)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>

        <ReatribuirModal
          open={reatribuirOpen}
          onOpenChange={setReatribuirOpen}
          leadsSel={selectedLeads}
          terceiros={opcoes?.terceiros ?? []}
          onDone={() => { clear(); refresh(); }}
        />
        <AlterarDataFimModal
          open={dataFimOpen}
          onOpenChange={setDataFimOpen}
          prospeccaoIds={selectedProspIds}
          onDone={() => { refresh(); }}
        />
        <EncerrarEventoModal
          open={encerrarOpen}
          onOpenChange={setEncerrarOpen}
          prospeccaoId={encerrarProspId}
          eventoLabel={selectedLeads.find((l) => l.prospeccao_id === encerrarProspId)?.evento_titulo ?? ""}
          onDone={() => { clear(); refresh(); }}
        />
      </div>
    </DashboardLayout>
  );
}

// ---------- Modais ----------

function ReatribuirModal({
  open, onOpenChange, leadsSel, terceiros, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  leadsSel: DiagnosticoLead[];
  terceiros: { id: string; nome: string }[];
  onDone: () => void;
}) {
  const [novo, setNovo] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!novo) { toast.error("Selecione um responsável"); return; }
    setLoading(true);
    const pares = leadsSel.map((l) => ({ contato_id: l.contato_id, prospeccao_id: l.prospeccao_id }));
    const { data, error } = await (supabase as any).rpc("bulk_reatribuir_leads_diagnostico", {
      pares, novo_responsavel_id: novo, motivo: motivo || null,
    });
    setLoading(false);
    if (error) { toast.error("Falha ao reatribuir: " + error.message); return; }
    toast.success(`${data} lead(s) reatribuído(s)`);
    onOpenChange(false);
    setNovo(""); setMotivo("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reatribuir {leadsSel.length} lead(s)</DialogTitle>
          <DialogDescription>Os leads passarão para status Atribuído sob o novo responsável.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Novo responsável</label>
            <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm" value={novo} onChange={(e) => setNovo(e.target.value)}>
              <option value="">Selecione…</option>
              {terceiros.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>{loading ? "Reatribuindo…" : "Reatribuir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlterarDataFimModal({
  open, onOpenChange, prospeccaoIds, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  prospeccaoIds: string[]; onDone: () => void;
}) {
  const [novaData, setNovaData] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!novaData) { toast.error("Escolha uma nova data"); return; }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("bulk_alterar_data_fim_diagnostico", {
      prospeccao_ids: prospeccaoIds, nova_data: novaData,
    });
    setLoading(false);
    if (error) { toast.error("Falha: " + error.message); return; }
    toast.success(`${data} evento(s) atualizado(s)`);
    onOpenChange(false); setNovaData("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar data final</DialogTitle>
          <DialogDescription>{prospeccaoIds.length} evento(s) receberão a nova data final.</DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-xs text-muted-foreground">Nova data final</label>
          <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="[color-scheme:light] dark:[color-scheme:dark]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>{loading ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EncerrarEventoModal({
  open, onOpenChange, prospeccaoId, eventoLabel, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  prospeccaoId: string | null; eventoLabel: string; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    if (!prospeccaoId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("encerrar_evento_diagnostico", { prospeccao_id_param: prospeccaoId });
    setLoading(false);
    if (error) { toast.error("Falha ao encerrar: " + error.message); return; }
    toast.success(`Evento encerrado. ${data?.descartados ?? 0} lead(s) marcados como Descartado.`);
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar evento</DialogTitle>
          <DialogDescription>
            {eventoLabel ? <>Evento: <b>{eventoLabel}</b>. </> : null}
            Leads sem responsável e sem status final serão marcados como Descartado. Esta ação é irreversível.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>{loading ? "Encerrando…" : "Encerrar evento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Trash2, Check, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

// ---------- Types ----------
type Loja = { dealer_id: string; marca: string; uf: string; nome: string };

type DiaKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
const DIAS: { key: DiaKey; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type Faixa = { revisao_numero: number; km_min: number; km_max: number };

type ConfigState = {
  dias: Record<DiaKey, boolean>;
  manha: { inicio: string; fim: string; slots: number };
  tarde: { inicio: string; fim: string; slots: number };
  sabado: { inicio: string; fim: string; slots: number };
  revisao_maxima: number;
  meses_sobreposicao: number;
  antecedencia_dias: number;
  faixas: Faixa[];
};

const DEFAULT_CONFIG: ConfigState = {
  dias: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: true, dom: false },
  manha: { inicio: "08:00", fim: "12:00", slots: 3 },
  tarde: { inicio: "13:00", fim: "18:00", slots: 3 },
  sabado: { inicio: "08:00", fim: "10:00", slots: 2 },
  revisao_maxima: 12,
  meses_sobreposicao: 12,
  antecedencia_dias: 30,
  faixas: [
    { revisao_numero: 1, km_min: 0, km_max: 10000 },
    { revisao_numero: 2, km_min: 10001, km_max: 20000 },
    { revisao_numero: 3, km_min: 20001, km_max: 30000 },
  ],
};

const WEBHOOK_BASE = "https://automatemaiawh.sagadatadriven.com.br/webhook";

function cloneConfig(c: ConfigState): ConfigState {
  return {
    ...c,
    dias: { ...c.dias },
    manha: { ...c.manha },
    tarde: { ...c.tarde },
    sabado: { ...c.sabado },
    faixas: c.faixas.map((f) => ({ ...f })),
  };
}

function pickConfigSlice(c: ConfigState) {
  const { faixas, ...rest } = c;
  return rest;
}
function isConfigDirty(a: ConfigState, b: ConfigState) {
  return JSON.stringify(pickConfigSlice(a)) !== JSON.stringify(pickConfigSlice(b));
}
function isRangesDirty(a: ConfigState, b: ConfigState) {
  return JSON.stringify(a.faixas) !== JSON.stringify(b.faixas);
}

export function ConfiguracoesPosVendasTab() {
  const { activeCompany } = useCompany();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [lojaError, setLojaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [original, setOriginal] = useState<ConfigState | null>(null);
  const [usouDefault, setUsouDefault] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingRanges, setSavingRanges] = useState(false);
  const [flashConfig, setFlashConfig] = useState(false);
  const [flashRanges, setFlashRanges] = useState(false);

  // Load loja automatically from active company (crm_id = dealer_id)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLojaError(null);
      setLoja(null);
      setConfig(null);
      setOriginal(null);
      if (!activeCompany?.id) return;
      const { data, error } = await supabase
        .from("empresas")
        .select("crm_id, marca, uf, nome_empresa")
        .eq("id", activeCompany.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLojaError("Erro ao carregar dados da empresa.");
        return;
      }
      if (!data?.crm_id) {
        setLojaError("Empresa ativa não possui CRM ID cadastrado. Configure o CRM ID em Administração › Empresas.");
        return;
      }
      setLoja({
        dealer_id: String(data.crm_id),
        marca: data.marca ?? "-",
        uf: data.uf ?? "-",
        nome: data.nome_empresa,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  useEffect(() => {
    if (!loja) return;
    setLoading(true);
    const t = setTimeout(() => {
      const base = cloneConfig(DEFAULT_CONFIG);
      setConfig(base);
      setOriginal(cloneConfig(base));
      setUsouDefault(true);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [loja?.dealer_id]);

  const configDirty = !!(config && original && isConfigDirty(config, original));
  const rangesDirty = !!(config && original && isRangesDirty(config, original));

  // ---------- Validations ----------
  const semDiaUtil =
    config && !config.dias.seg && !config.dias.ter && !config.dias.qua && !config.dias.qui && !config.dias.sex;

  function validarHorario(inicio: string, fim: string) {
    return inicio < fim;
  }

  function validarConfig(c: ConfigState): string | null {
    if (!validarHorario(c.manha.inicio, c.manha.fim)) return "Horário da manhã inválido (início ≥ fim).";
    if (!validarHorario(c.tarde.inicio, c.tarde.fim)) return "Horário da tarde inválido (início ≥ fim).";
    if (c.dias.sab && !validarHorario(c.sabado.inicio, c.sabado.fim))
      return "Horário de sábado inválido (início ≥ fim).";
    return null;
  }

  function validarRanges(c: ConfigState): string | null {
    if (c.faixas.length < 3) return "Mínimo de 3 faixas de KM.";
    if (c.faixas.length > c.revisao_maxima)
      return `Número de faixas (${c.faixas.length}) maior que a Revisão Máxima (${c.revisao_maxima}).`;
    for (let i = 0; i < c.faixas.length; i++) {
      const f = c.faixas[i];
      if (f.revisao_numero !== i + 1) return `Numeração de revisão deve ser sequencial (linha ${i + 1}).`;
      if (f.km_min >= f.km_max) return `Faixa ${f.revisao_numero}: KM Mínimo deve ser menor que KM Máximo.`;
      if (i > 0 && f.km_min <= c.faixas[i - 1].km_max)
        return `Faixa ${f.revisao_numero}: sobreposição com a faixa anterior.`;
    }
    return null;
  }

  const gaps = useMemo(() => {
    if (!config) return [] as number[];
    const out: number[] = [];
    for (let i = 1; i < config.faixas.length; i++) {
      if (config.faixas[i].km_min - config.faixas[i - 1].km_max > 1) out.push(config.faixas[i].revisao_numero);
    }
    return out;
  }, [config]);

  // ---------- Actions ----------
  function updateConfig(patch: Partial<ConfigState>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  }

  function toggleDia(k: DiaKey, v: boolean) {
    setConfig((c) => (c ? { ...c, dias: { ...c.dias, [k]: v } } : c));
  }

  function addFaixa() {
    setConfig((c) => {
      if (!c) return c;
      if (c.faixas.length >= c.revisao_maxima) {
        toast.error(`Máximo de ${c.revisao_maxima} faixas atingido.`);
        return c;
      }
      const last = c.faixas[c.faixas.length - 1];
      const km_min = last.km_max + 1;
      const km_max = km_min + 10000;
      return {
        ...c,
        faixas: [...c.faixas, { revisao_numero: last.revisao_numero + 1, km_min, km_max }],
      };
    });
  }

  function removeFaixa(idx: number) {
    setConfig((c) => {
      if (!c) return c;
      if (c.faixas.length <= 3) {
        toast.error("Mínimo de 3 faixas.");
        return c;
      }
      const next = c.faixas.filter((_, i) => i !== idx).map((f, i) => ({ ...f, revisao_numero: i + 1 }));
      return { ...c, faixas: next };
    });
  }

  function updateFaixa(idx: number, patch: Partial<Faixa>) {
    setConfig((c) => {
      if (!c) return c;
      const faixas = c.faixas.map((f, i) => (i === idx ? { ...f, ...patch } : f));
      return { ...c, faixas };
    });
  }

  async function handleSalvarConfig() {
    if (!config || !loja) return;
    const err = validarConfig(config);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingConfig(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const headers = { "Content-Type": "application/json", saga_one_supabase: token };
      const payloadConfig = {
        dealer_id: loja.dealer_id,
        faz_segunda: config.dias.seg,
        faz_terca: config.dias.ter,
        faz_quarta: config.dias.qua,
        faz_quinta: config.dias.qui,
        faz_sexta: config.dias.sex,
        faz_sabado: config.dias.sab,
        faz_domingo: config.dias.dom,
        manha_inicio: config.manha.inicio,
        manha_fim: config.manha.fim,
        manha_slots: config.manha.slots,
        tarde_inicio: config.tarde.inicio,
        tarde_fim: config.tarde.fim,
        tarde_slots: config.tarde.slots,
        sabado_inicio: config.sabado.inicio,
        sabado_fim: config.sabado.fim,
        sabado_slots: config.sabado.slots,
        revisao_maxima: config.revisao_maxima,
        meses_sobreposicao: config.meses_sobreposicao,
        antecedencia_dias: config.antecedencia_dias,
      };
      const r = await fetch(`${WEBHOOK_BASE}/upsert-paty-posvendas-config`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadConfig),
      });
      if (!r.ok) throw new Error(`Falha ao salvar configurações (${r.status})`);
      setOriginal((prev) => (prev ? { ...prev, ...pickConfigSlice(config) } : cloneConfig(config)));
      setUsouDefault(false);
      setFlashConfig(true);
      toast.success("Configurações salvas com sucesso.");
      setTimeout(() => setFlashConfig(false), 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar configurações.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSalvarRanges() {
    if (!config || !loja) return;
    const err = validarRanges(config);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingRanges(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const headers = { "Content-Type": "application/json", saga_one_supabase: token };
      const payloadRanges = {
        dealer_id: loja.dealer_id,
        ranges: config.faixas.map((f) => ({
          revisao_numero: f.revisao_numero,
          km_min: f.km_min,
          km_max: f.km_max,
        })),
      };
      const r = await fetch(`${WEBHOOK_BASE}/upsert-paty-revision-range`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadRanges),
      });
      if (!r.ok) throw new Error(`Falha ao salvar faixas (${r.status})`);
      setOriginal((prev) => (prev ? { ...prev, faixas: config.faixas.map((f) => ({ ...f })) } : cloneConfig(config)));
      setFlashRanges(true);
      toast.success("Faixas de KM salvas com sucesso.");
      setTimeout(() => setFlashRanges(false), 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar faixas.");
    } finally {
      setSavingRanges(false);
    }
  }

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Bloco 1 - Loja */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" /> Loja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lojaError ? (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{lojaError}</AlertDescription>
            </Alert>
          ) : !loja ? (
            <Skeleton className="h-5 w-64" />
          ) : (
            <p className="text-sm">
              Configurando: <span className="font-medium">{loja.marca} - {loja.uf}</span>{" "}
              <span className="text-muted-foreground">({loja.nome})</span>
              <span className="text-xs text-muted-foreground ml-2">dealer_id: {loja.dealer_id}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {usouDefault && loja && (
        <Alert className="border-yellow-500/40 bg-yellow-500/10 text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma configuração encontrada para esta loja. Os campos estão preenchidos com valores padrão.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {config && !loading && (
        <>
          {/* Bloco 2 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dias e horários de atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Dias que a loja atende</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => {
                    const active = config.dias[d.key];
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => toggleDia(d.key, !active)}
                        className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {semDiaUtil && (
                  <Alert className="mt-3 border-destructive/40 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>A loja não atende de segunda a sexta. Verifique.</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="grid gap-3">
                <TurnoRow
                  label="Manhã (Seg a Sex)"
                  turno={config.manha}
                  onChange={(v) => updateConfig({ manha: { ...config.manha, ...v } })}
                />
                <TurnoRow
                  label="Tarde (Seg a Sex)"
                  turno={config.tarde}
                  onChange={(v) => updateConfig({ tarde: { ...config.tarde, ...v } })}
                />
                <TurnoRow
                  label="Sábado"
                  turno={config.sabado}
                  onChange={(v) => updateConfig({ sabado: { ...config.sabado, ...v } })}
                  inicioReadonly
                  disabled={!config.dias.sab}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bloco 3 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Regras de revisão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumField
                  label="Revisão Máxima"
                  value={config.revisao_maxima}
                  min={1}
                  max={99}
                  onChange={(v) => updateConfig({ revisao_maxima: v })}
                />
                <NumField
                  label="Meses p/ sobreposição (tempo > KM)"
                  value={config.meses_sobreposicao}
                  min={1}
                  max={60}
                  onChange={(v) => updateConfig({ meses_sobreposicao: v })}
                />
                <NumField
                  label="Antecedência p/ agendar (dias)"
                  value={config.antecedencia_dias}
                  min={0}
                  max={90}
                  onChange={(v) => updateConfig({ antecedencia_dias: v })}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando um cliente está há {config.meses_sobreposicao}+ meses sem fazer revisão, o tempo passa a valer mais que a quilometragem — o sistema agenda a próxima revisão sequencial. O cliente pode agendar com até {config.antecedencia_dias} dias de antecedência. A revisão mais alta que o sistema agenda é a {config.revisao_maxima}ª.
              </p>
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleSalvarConfig}
                  disabled={!configDirty || savingConfig}
                  className={flashConfig ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
                >
                  {savingConfig ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : flashConfig ? (
                    <><Check className="h-4 w-4 mr-2" /> Salvo</>
                  ) : (
                    "Salvar configurações"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 4 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Faixas de KM por revisão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Nº Revisão</TableHead>
                    <TableHead>KM Mínimo</TableHead>
                    <TableHead>KM Máximo</TableHead>
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.faixas.map((f, i) => {
                    const overlap = i > 0 && f.km_min <= config.faixas[i - 1].km_max;
                    const bad = f.km_min >= f.km_max || overlap;
                    const gap = i > 0 && f.km_min - config.faixas[i - 1].km_max > 1;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{f.revisao_numero}ª</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-32"
                            value={f.km_min}
                            onChange={(e) => updateFaixa(i, { km_min: Number(e.target.value) })}
                          />
                          {gap && (
                            <p className="text-[11px] text-yellow-400 mt-1">Gap com a faixa anterior.</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className={`h-8 w-32 ${bad ? "border-destructive" : ""}`}
                            value={f.km_max}
                            onChange={(e) => updateFaixa(i, { km_max: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={config.faixas.length <= 3}
                            onClick={() => removeFaixa(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center">
                <p className="text-[11px] text-muted-foreground">
                  {config.faixas.length} de no máx. {config.revisao_maxima} faixas • mínimo 3
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFaixa}
                  disabled={config.faixas.length >= config.revisao_maxima}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
                </Button>
              </div>
              {gaps.length > 0 && (
                <p className="text-xs text-yellow-400">Aviso: existem gaps nas faixas {gaps.join(", ")}.</p>
              )}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleSalvarRanges}
                  disabled={!rangesDirty || savingRanges}
                  className={flashRanges ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
                >
                  {savingRanges ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : flashRanges ? (
                    <><Check className="h-4 w-4 mr-2" /> Salvo</>
                  ) : (
                    "Salvar faixas de KM"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------
function TurnoRow({
  label,
  turno,
  onChange,
  inicioReadonly,
  disabled,
}: {
  label: string;
  turno: { inicio: string; fim: string; slots: number };
  onChange: (v: Partial<{ inicio: string; fim: string; slots: number }>) => void;
  inicioReadonly?: boolean;
  disabled?: boolean;
}) {
  const invalid = turno.inicio >= turno.fim;
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end rounded-md border border-border p-3 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Início</Label>
        <Input
          type="time"
          className="h-8 w-28"
          value={turno.inicio}
          readOnly={inicioReadonly}
          onChange={(e) => onChange({ inicio: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Fim</Label>
        <Input
          type="time"
          className={`h-8 w-28 ${invalid ? "border-destructive" : ""}`}
          value={turno.fim}
          onChange={(e) => onChange({ fim: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Slots</Label>
        <Input
          type="number"
          min={1}
          max={10}
          className="h-8 w-20"
          value={turno.slots}
          onChange={(e) => onChange({ slots: Math.max(1, Math.min(10, Number(e.target.value))) })}
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        className="h-9"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      />
    </div>
  );
}
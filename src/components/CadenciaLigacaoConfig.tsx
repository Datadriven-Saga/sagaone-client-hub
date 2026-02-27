import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, Phone, Settings2, CalendarClock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePriLigacaoEventos } from "@/hooks/usePriLigacaoEventos";
import { cn } from "@/lib/utils";

interface CadenciaLigacaoConfigProps {
  className?: string;
}

const DIAS_SEMANA = [
  { key: "dom", label: "D", full: "Domingo" },
  { key: "seg", label: "S", full: "Segunda" },
  { key: "ter", label: "T", full: "Terça" },
  { key: "qua", label: "Q", full: "Quarta" },
  { key: "qui", label: "Q", full: "Quinta" },
  { key: "sex", label: "S", full: "Sexta" },
  { key: "sab", label: "S", full: "Sábado" },
];

interface PriAgent {
  id: string;
  nome: string;
  telefone: string;
}

export function CadenciaLigacaoConfig({ className }: CadenciaLigacaoConfigProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Pri agents
  const [priAgents, setPriAgents] = useState<PriAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedPriId, setSelectedPriId] = useState<string>("");

  const selectedPri = priAgents.find(a => a.id === selectedPriId);
  const telefonePri = selectedPri?.telefone?.replace(/\D/g, "") || "";

  // Fetch events for selected Pri
  const { data: eventos = [], isLoading: loadingEventos } = usePriLigacaoEventos(telefonePri);

  // Selected event IDs
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [showInativos, setShowInativos] = useState(false);

  // Toggles
  const [evtStatus, setEvtStatus] = useState(true);
  const [ligacaoAtendida, setLigacaoAtendida] = useState(false);
  const [statusAgendado, setStatusAgendado] = useState(false);

  // Numeric
  const [numTentativas, setNumTentativas] = useState(2);

  // Ordering
  const [orderBy, setOrderBy] = useState<"ASC" | "DESC">("ASC");

  // Recurrence
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("07:45");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);

  // Fetch Pri agents on mount
  useEffect(() => {
    async function fetchPriAgents() {
      setLoadingAgents(true);
      try {
        const { data, error } = await supabase
          .from("agentes_ia")
          .select("id, nome, telefone")
          .eq("ativo", true)
          .not("telefone", "is", null);

        if (error) throw error;

        const searchPatterns = ["ligação", "ligacao", "ligaçao"];
        const filtered = (data || []).filter((a: any) => {
          const nome = String(a.nome || "").toLowerCase();
          return searchPatterns.some(p => nome.includes(p)) && a.telefone;
        });

        // Deduplicate by normalized phone number, keeping first occurrence
        const seen = new Map<string, boolean>();
        const unique = filtered.filter((a: any) => {
          const normalized = String(a.telefone || "").replace(/\D/g, "");
          if (!normalized || seen.has(normalized)) return false;
          seen.set(normalized, true);
          return true;
        });

        // Normalize phone display
        const withNormalizedPhone = unique.map((a: any) => ({
          ...a,
          telefone: String(a.telefone || "").replace(/\D/g, ""),
        }));

        setPriAgents(withNormalizedPhone as PriAgent[]);
        if (filtered.length === 1) {
          setSelectedPriId(filtered[0].id);
        }
      } catch (err) {
        console.error("Erro ao buscar agentes Pri:", err);
      } finally {
        setLoadingAgents(false);
      }
    }
    fetchPriAgents();
  }, []);

  // Reset selected events when Pri changes
  useEffect(() => {
    setSelectedEventIds([]);
  }, [selectedPriId]);

  const toggleEventId = (id: number) => {
    setSelectedEventIds(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleDia = (key: string) => {
    setDiasAtivos(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (selectedEventIds.length === 0) {
      toast({ title: "Selecione ao menos um evento", variant: "destructive" });
      return;
    }
    if (!telefonePri) {
      toast({ title: "Selecione um agente Pri", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id_evento: selectedEventIds.join(", "),
        evt_status: evtStatus,
        num_tentativas: numTentativas,
        ligacao_atendida: ligacaoAtendida,
        status_agendado: statusAgendado,
        telefone_pri: telefonePri,
        order_by: orderBy,
        recorrencia: {
          data_inicio: dataInicio,
          data_termino: dataTermino,
          horario_inicio: horarioInicio,
          horario_fim: horarioFim,
          dias_semana: diasAtivos,
        },
      };

      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: {
          ...payload,
          _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao",
        },
      });

      if (error) throw error;

      toast({ title: "Cadência configurada", description: "A cadência de ligação foi configurada com sucesso." });
    } catch (err: any) {
      console.error("Erro ao configurar cadência:", err);
      toast({ title: "Erro ao configurar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card className="border-none shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Cadência de Ligação</CardTitle>
              <CardDescription>Configure os filtros e recorrência do Agente de Voz (Pri)</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Seleção de Pri */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Agente Pri (Ligação)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Selecione o agente Pri</Label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando agentes...
              </div>
            ) : priAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum agente Pri encontrado.</p>
            ) : (
              <Select value={selectedPriId} onValueChange={setSelectedPriId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um agente Pri..." />
                </SelectTrigger>
                <SelectContent>
                  {priAgents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.nome} — {agent.telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filtros da Query</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Eventos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Eventos (id_evento)</Label>
              {selectedPriId && eventos.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-muted-foreground">Mostrar inativos</span>
                  <Switch checked={showInativos} onCheckedChange={setShowInativos} />
                </label>
              )}
            </div>
            {!selectedPriId ? (
              <p className="text-sm text-muted-foreground">Selecione um agente Pri acima para carregar os eventos.</p>
            ) : loadingEventos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando eventos...
              </div>
            ) : eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento encontrado para este agente.</p>
            ) : (() => {
              const filteredEventos = showInativos
                ? eventos
                : eventos.filter(evt => {
                    const status = evt.evt_status;
                    if (typeof status === "boolean") return status;
                    if (typeof status === "string") return status.toLowerCase() === "true" || status === "1";
                    if (typeof status === "number") return status === 1;
                    return true; // show if unknown
                  });
              return filteredEventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento ativo encontrado. Ative "Mostrar inativos" para ver todos.</p>
              ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto rounded-lg border p-3">
                  {filteredEventos.map(evt => {
                    const evtId = evt.id_evento ?? (evt as any).id;
                    const evtName = evt.nome || `Evento ${evtId}`;
                    const isChecked = selectedEventIds.includes(Number(evtId));
                    return (
                      <label
                        key={evtId}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors",
                          isChecked
                            ? "border-primary bg-primary/5"
                            : "border-input hover:border-primary/40"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleEventId(Number(evtId))}
                        />
                        <span className="text-sm font-medium">{evtName}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{evtId}</Badge>
                      </label>
                    );
                  })}
                </div>
                {selectedEventIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedEventIds.length} evento(s) selecionado(s)
                  </p>
                )}
              </div>
              );
            })()}
          </div>

          {/* Toggles row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="evt-status" className="text-sm">evt_status</Label>
              <Switch id="evt-status" checked={evtStatus} onCheckedChange={setEvtStatus} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="lig-atendida" className="text-sm">ligacao_atendida</Label>
              <Switch id="lig-atendida" checked={ligacaoAtendida} onCheckedChange={setLigacaoAtendida} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="status-agendado" className="text-sm">status_agendado</Label>
              <Switch id="status-agendado" checked={statusAgendado} onCheckedChange={setStatusAgendado} />
            </div>
          </div>

          {/* Tentativas + Ordenação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Máx. Tentativas</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={numTentativas}
                onChange={e => setNumTentativas(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ordenação (tentativas)</Label>
              <Select value={orderBy} onValueChange={(v: "ASC" | "DESC") => setOrderBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASC">Crescente (ASC)</SelectItem>
                  <SelectItem value="DESC">Decrescente (DESC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recorrência */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recorrência</CardTitle>
            </div>
          </div>
          <CardDescription>
            Envia de forma consolidada os alertas conforme recorrência configurada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de término</Label>
              <Input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} />
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Horário de início</Label>
              <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário de encerramento</Label>
              <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
            </div>
          </div>

          {/* Weekday selector */}
          <div className="space-y-2">
            <Label>Dias da semana para envio:</Label>
            <div className="flex gap-2 flex-wrap">
              {DIAS_SEMANA.map(dia => {
                const isActive = diasAtivos.includes(dia.key);
                return (
                  <button
                    key={dia.key}
                    type="button"
                    onClick={() => toggleDia(dia.key)}
                    title={dia.full}
                    className={cn(
                      "w-10 h-10 rounded-lg text-sm font-semibold transition-colors border",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:border-primary/50"
                    )}
                  >
                    {dia.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              D = Domingo, S = Segunda, T = Terça, Q = Quarta, Q = Quinta, S = Sexta, S = Sábado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Configurar Cadência
      </Button>
    </div>
  );
}

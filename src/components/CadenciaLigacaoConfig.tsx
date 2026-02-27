import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Phone, Settings2, CalendarClock, X, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CadenciaLigacaoConfigProps {
  telefonePri?: string;
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

export function CadenciaLigacaoConfig({ telefonePri = "", className }: CadenciaLigacaoConfigProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Event IDs
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [eventInput, setEventInput] = useState("");

  // Toggles
  const [evtStatus, setEvtStatus] = useState(true);
  const [ligacaoAtendida, setLigacaoAtendida] = useState(false);
  const [statusAgendado, setStatusAgendado] = useState(false);

  // Numeric
  const [numTentativas, setNumTentativas] = useState(2);

  // Telefone
  const [telefone, setTelefone] = useState(telefonePri);

  // Ordering
  const [orderBy, setOrderBy] = useState<"ASC" | "DESC">("ASC");

  // Recurrence
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");
  const [intervaloValor, setIntervaloValor] = useState(1);
  const [intervaloUnidade, setIntervaloUnidade] = useState("dias");
  const [horario, setHorario] = useState("07:45");
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);

  const addEventId = useCallback(() => {
    const trimmed = eventInput.trim();
    if (trimmed && !eventIds.includes(trimmed)) {
      setEventIds(prev => [...prev, trimmed]);
      setEventInput("");
    }
  }, [eventInput, eventIds]);

  const removeEventId = (id: string) => {
    setEventIds(prev => prev.filter(e => e !== id));
  };

  const toggleDia = (key: string) => {
    setDiasAtivos(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (eventIds.length === 0) {
      toast({ title: "Informe ao menos um ID de evento", variant: "destructive" });
      return;
    }
    if (!telefone.trim()) {
      toast({ title: "Informe o telefone primário", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id_evento: eventIds.map(Number),
        evt_status: evtStatus,
        num_tentativas: numTentativas,
        ligacao_atendida: ligacaoAtendida,
        status_agendado: statusAgendado,
        telefone_pri: telefone.replace(/\D/g, ""),
        order_by: orderBy,
        recorrencia: {
          data_inicio: dataInicio,
          data_termino: dataTermino,
          intervalo_valor: intervaloValor,
          intervalo_unidade: intervaloUnidade,
          horario,
          dias_semana: diasAtivos,
        },
      };

      const { data, error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: {
          ...payload,
          _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao",
        },
      });

      if (error) throw error;

      toast({ title: "Configurações salvas", description: "A cadência de ligação foi configurada com sucesso." });
    } catch (err: any) {
      console.error("Erro ao salvar cadência ligação:", err);
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
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

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filtros da Query</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Event IDs */}
          <div className="space-y-2">
            <Label>Eventos (id_evento)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 248"
                value={eventInput}
                onChange={e => setEventInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEventId(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addEventId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {eventIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {eventIds.map(id => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {id}
                    <button onClick={() => removeEventId(id)} className="rounded-full hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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

          {/* Tentativas + Telefone + Ordenação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Label>Telefone Primário</Label>
              <Input
                placeholder="5561999999999"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
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

          {/* Interval + Time */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>A cada</Label>
              <Input
                type="number"
                min={1}
                value={intervaloValor}
                onChange={e => setIntervaloValor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={intervaloUnidade} onValueChange={setIntervaloUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutos">Minuto(s)</SelectItem>
                  <SelectItem value="horas">Hora(s)</SelectItem>
                  <SelectItem value="dias">Dia(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
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
        Salvar Configurações
      </Button>
    </div>
  );
}

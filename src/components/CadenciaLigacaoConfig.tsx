import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Phone, Settings2, CalendarClock, Loader2, X, PhoneCall, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

export function CadenciaLigacaoConfig({ className }: CadenciaLigacaoConfigProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Recurrence toggle
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(true);

  // Dates
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");

  // Frequency
  const [frequenciaDias, setFrequenciaDias] = useState(1);
  const [horario, setHorario] = useState("07:45");

  // Weekdays
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);

  // Query params
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [eventTagInput, setEventTagInput] = useState("");
  const [telefonePri, setTelefonePri] = useState("");
  const [numTentativas, setNumTentativas] = useState(2);
  const [evtStatus, setEvtStatus] = useState(true);
  const [ligacaoAtendida, setLigacaoAtendida] = useState(false);
  const [statusAgendado, setStatusAgendado] = useState(false);
  const [orderBy, setOrderBy] = useState<"ASC" | "DESC">("ASC");

  // Test call
  const [testNumber, setTestNumber] = useState("");

  const addEventTag = () => {
    const val = eventTagInput.trim();
    if (val && !eventTags.includes(val)) {
      setEventTags(prev => [...prev, val]);
    }
    setEventTagInput("");
  };

  const removeEventTag = (tag: string) => {
    setEventTags(prev => prev.filter(t => t !== tag));
  };

  const handleEventTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEventTag();
    }
  };

  const toggleDia = (key: string) => {
    setDiasAtivos(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const buildPayload = () => ({
    id_evento: eventTags.join(", "),
    telefone_pri: telefonePri.replace(/\D/g, ""),
    evt_status: evtStatus,
    num_tentativas: numTentativas,
    ligacao_atendida: ligacaoAtendida,
    status_agendado: statusAgendado,
    order_by: orderBy,
    recorrencia: recorrenciaAtiva ? {
      data_inicio: dataInicio,
      data_termino: dataTermino,
      frequencia_dias: frequenciaDias,
      horario,
      dias_semana: diasAtivos,
    } : null,
  });

  const handleSave = async () => {
    if (eventTags.length === 0) {
      toast({ title: "Adicione ao menos um id_evento", variant: "destructive" });
      return;
    }
    if (!telefonePri.trim()) {
      toast({ title: "Informe o telefone_pri", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: {
          ...buildPayload(),
          _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao",
        },
      });
      if (error) throw error;
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestCall = async () => {
    if (!testNumber.trim()) {
      toast({ title: "Informe um número para teste", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: {
          telefone_teste: testNumber.replace(/\D/g, ""),
          telefone_pri: telefonePri.replace(/\D/g, ""),
          _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao",
        },
      });
      if (error) throw error;
      toast({ title: "Teste disparado!", description: `Ligação de teste para ${testNumber}` });
    } catch (err: any) {
      toast({ title: "Erro no teste", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Controle de Cadência */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Controle de Cadência</CardTitle>
                <CardDescription>Configure a recorrência dos disparos de ligação</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="recorrencia-toggle" className="text-sm text-muted-foreground">Recorrência</Label>
              <Switch id="recorrencia-toggle" checked={recorrenciaAtiva} onCheckedChange={setRecorrenciaAtiva} />
            </div>
          </div>
        </CardHeader>
        {recorrenciaAtiva && (
          <CardContent className="space-y-5">
            {/* Período */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de Início</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Término</Label>
                <Input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} />
              </div>
            </div>

            {/* Frequência + Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>A cada X Dia(s)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={frequenciaDias}
                  onChange={e => setFrequenciaDias(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
              </div>
            </div>

            {/* Dias da semana */}
            <div className="space-y-2">
              <Label>Dias da semana</Label>
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
        )}
      </Card>

      {/* Parâmetros da Query */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Parâmetros da Query</CardTitle>
              <CardDescription>Filtros aplicados à base de ligação</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* id_evento tags */}
          <div className="space-y-2">
            <Label>id_evento</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 248"
                value={eventTagInput}
                onChange={e => setEventTagInput(e.target.value)}
                onKeyDown={handleEventTagKeyDown}
                className="flex-1"
              />
              <Button type="button" size="icon" variant="outline" onClick={addEventTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {eventTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {eventTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeEventTag(tag)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* telefone_pri */}
          <div className="space-y-1.5">
            <Label>telefone_pri</Label>
            <Input
              placeholder="Ex: 5511999999999"
              value={telefonePri}
              onChange={e => setTelefonePri(e.target.value)}
            />
          </div>

          {/* num_tentativas */}
          <div className="space-y-1.5">
            <Label>num_tentativas (limite máximo)</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={numTentativas}
              onChange={e => setNumTentativas(Number(e.target.value))}
            />
          </div>

          {/* Toggles */}
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

          {/* Ordenação */}
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
        </CardContent>
      </Card>

      {/* Ações */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Ações</CardTitle>
              <CardDescription>Teste e salve a configuração</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test call */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Número para teste (Ex: 11999999999)"
              value={testNumber}
              onChange={e => setTestNumber(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleTestCall}
              disabled={testing}
              className="shrink-0"
            >
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneCall className="h-4 w-4 mr-2" />}
              Testar Ligação
            </Button>
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

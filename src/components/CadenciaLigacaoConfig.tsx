import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Phone, Settings2, CalendarClock, Loader2, X, PhoneCall, Plus, UserPlus, Trash2, RefreshCw, CheckCircle, Calendar } from "lucide-react";
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
  dealer_id?: string;
  empresa_id?: string;
}

interface ContatoTeste {
  id: string;
  nome: string;
  telefone: string;
}

interface EventoPriVoz {
  id: string;
  id_evento: number;
  nome: string;
  evt_status?: string;
}

export function CadenciaLigacaoConfig({ className }: CadenciaLigacaoConfigProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Pri agents
  const [priAgents, setPriAgents] = useState<PriAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedPriId, setSelectedPriId] = useState<string>("");

  const selectedPri = priAgents.find(a => a.id === selectedPriId);
  const telefonePri = selectedPri?.telefone || "";

  // ─── Cadência state ───
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");
  const [frequenciaDias, setFrequenciaDias] = useState(1);
  const [horario, setHorario] = useState("07:45");
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);

  // Query params
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [eventTagInput, setEventTagInput] = useState("");
  const [numTentativas, setNumTentativas] = useState(2);
  const [evtStatus, setEvtStatus] = useState(true);
  const [ligacaoAtendida, setLigacaoAtendida] = useState(false);
  const [statusAgendado, setStatusAgendado] = useState(false);
  const [orderBy, setOrderBy] = useState<"ASC" | "DESC">("ASC");

  // ─── Testar state ───
  const [contatos, setContatos] = useState<ContatoTeste[]>([
    { id: crypto.randomUUID(), nome: "", telefone: "" }
  ]);
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [baseConfirmada, setBaseConfirmada] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>("");

  // Events for testar
  const { data: eventosData = [], isLoading: loadingEventos } = usePriLigacaoEventos(telefonePri);

  const eventos = useMemo<EventoPriVoz[]>(() => {
    return (eventosData || []).map((evt: any) => {
      const rawStatus = evt?.evt_status ?? evt?.status;
      const isAtivo = rawStatus === true || String(rawStatus).toLowerCase() === "ativo" || String(rawStatus).toLowerCase() === "true" || rawStatus === "1" || rawStatus === 1;
      return {
        id: String(evt.id_evento || evt.id),
        id_evento: evt.id_evento || evt.id,
        nome: evt.nome || evt.name || `Evento ${evt.id_evento}`,
        evt_status: isAtivo ? "ativo" : "inativo",
      };
    });
  }, [eventosData]);

  useEffect(() => {
    if (eventoSelecionado) return;
    if (eventos.length === 0) return;
    const eventoAtivo = eventos.find((e) => e.evt_status === "ativo");
    setEventoSelecionado((eventoAtivo || eventos[0]).id);
  }, [eventos, eventoSelecionado]);

  // Fetch Pri agents
  useEffect(() => {
    async function fetchPriAgents() {
      setLoadingAgents(true);
      try {
        const { data, error } = await supabase
          .from("agentes_ia")
          .select("id, nome, telefone, dealer_id, empresa_id")
          .eq("ativo", true)
          .not("telefone", "is", null);
        if (error) throw error;

        const searchPatterns = ["ligação", "ligacao", "ligaçao"];
        const filtered = (data || []).filter((a: any) => {
          const nome = String(a.nome || "").toLowerCase();
          return searchPatterns.some(p => nome.includes(p)) && a.telefone;
        });

        const seen = new Map<string, boolean>();
        const unique = filtered.filter((a: any) => {
          const normalized = String(a.telefone || "").replace(/\D/g, "");
          if (!normalized || seen.has(normalized)) return false;
          seen.set(normalized, true);
          return true;
        });

        const withNormalizedPhone = unique.map((a: any) => ({
          ...a,
          telefone: String(a.telefone || "").replace(/\D/g, ""),
        }));

        setPriAgents(withNormalizedPhone as PriAgent[]);
        if (withNormalizedPhone.length === 1) {
          setSelectedPriId(withNormalizedPhone[0].id);
        }
      } catch (err) {
        console.error("Erro ao buscar agentes Pri:", err);
      } finally {
        setLoadingAgents(false);
      }
    }
    fetchPriAgents();
  }, []);

  // Reset when pri changes
  useEffect(() => {
    setEventTags([]);
    setEventoSelecionado("");
    setContatos([{ id: crypto.randomUUID(), nome: "", telefone: "" }]);
    setBaseConfirmada(false);
  }, [selectedPriId]);

  // ─── Tag helpers ───
  const addEventTag = () => {
    const val = eventTagInput.trim();
    if (val && !eventTags.includes(val)) setEventTags(prev => [...prev, val]);
    setEventTagInput("");
  };
  const removeEventTag = (tag: string) => setEventTags(prev => prev.filter(t => t !== tag));
  const handleEventTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEventTag(); }
  };
  const toggleDia = (key: string) => setDiasAtivos(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);

  // ─── Cadência save ───
  const handleSaveCadencia = async () => {
    if (eventTags.length === 0) { toast({ title: "Adicione ao menos um id_evento", variant: "destructive" }); return; }
    if (!telefonePri) { toast({ title: "Selecione um agente Pri", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload = {
        id_evento: eventTags.join(", "),
        telefone_pri: telefonePri,
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
      };
      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: { ...payload, _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao" },
      });
      if (error) throw error;
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Testar helpers ───
  const adicionarContato = () => setContatos(prev => [...prev, { id: crypto.randomUUID(), nome: "", telefone: "" }]);
  const removerContato = (id: string) => { if (contatos.length > 1) setContatos(prev => prev.filter(c => c.id !== id)); };
  const atualizarContato = (id: string, campo: "nome" | "telefone", valor: string) => {
    setContatos(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  };
  const limparFormulario = () => { setContatos([{ id: crypto.randomUUID(), nome: "", telefone: "" }]); setBaseConfirmada(false); };
  const contatosPreenchidos = contatos.filter(c => c.nome.trim() && c.telefone.trim()).length;

  const normalizePhoneTo10Digits = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
    if (digits.length === 11 && digits[2] === '9') digits = digits.slice(0, 2) + digits.slice(3);
    return digits;
  };

  const handleConfirmar = async () => {
    const contatosParaEnviar = contatos.filter(c => c.nome.trim() && c.telefone.trim()).map(c => ({ nome: c.nome.trim(), telefone: c.telefone.trim().replace(/\D/g, '') }));
    if (contatosParaEnviar.length === 0) { toast({ title: "Preencha pelo menos um contato", variant: "destructive" }); return; }
    if (!eventoSelecionado) { toast({ title: "Selecione um evento", variant: "destructive" }); return; }
    const eventoEscolhido = eventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) return;

    setConfirmando(true);
    try {
      const payload: Record<string, any> = {
        contatos: contatosParaEnviar,
        id_evento: eventoEscolhido.id_evento,
        telefone_pri: telefonePri,
        loja: selectedPri?.nome || 'Teste Rápido',
        sync_external: true,
      };
      if (selectedPri?.empresa_id) payload.empresa_id = selectedPri.empresa_id;

      const { data, error } = await supabase.functions.invoke('create-base-ligacao', { body: payload });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Base criada com sucesso!", description: `${data.summary?.supabase_salvos || contatosParaEnviar.length} contato(s) preparado(s)` });
        setBaseConfirmada(true);
      } else throw new Error(data?.error || "Falha ao criar base");
    } catch (error: any) {
      toast({ title: "Erro ao criar base", description: error.message, variant: "destructive" });
    } finally {
      setConfirmando(false);
    }
  };

  const handleDisparar = async () => {
    const contatosParaEnviar = contatos.filter(c => c.nome.trim() && c.telefone.trim()).map(c => ({ nome: c.nome.trim(), telefone_lead: normalizePhoneTo10Digits(c.telefone) }));
    if (contatosParaEnviar.length === 0) { toast({ title: "Adicione pelo menos um contato", variant: "destructive" }); return; }
    if (!telefonePri) { toast({ title: "Selecione um agente Pri", variant: "destructive" }); return; }
    if (!eventoSelecionado) { toast({ title: "Selecione um evento", variant: "destructive" }); return; }
    const eventoEscolhido = eventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) return;

    setDisparando(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { endpoint: 'dispara-ligacao', telefone_pri: telefonePri, id_evento: eventoEscolhido.id_evento, contatos: contatosParaEnviar },
      });
      if (error) throw error;
      toast({ title: "Disparo iniciado!", description: data?.message || `Ligação para ${contatosParaEnviar.length} contato(s) será realizada em instantes` });
    } catch (error: any) {
      toast({ title: "Erro ao disparar", description: error.message, variant: "destructive" });
    } finally {
      setDisparando(false);
    }
  };

  // ─── Render ───
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
              <CardTitle className="text-lg">Configuração de Ligação</CardTitle>
              <CardDescription>Configure cadências, filtros de query e teste ligações do Agente de Voz (Pri)</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Seleção de Pri (compartilhada) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Agente Pri (Ligação)</CardTitle>
          </div>
          <CardDescription>Selecione o agente para configurar a cadência ou testar ligações</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAgents ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando agentes...
            </div>
          ) : priAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum agente Pri encontrado.</p>
          ) : (
            <Select value={selectedPriId} onValueChange={setSelectedPriId}>
              <SelectTrigger><SelectValue placeholder="Escolha um agente Pri..." /></SelectTrigger>
              <SelectContent>
                {priAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.nome} — {agent.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Sub-tabs */}
      <Tabs defaultValue="cadencia" className="min-w-0">
        <TabsList>
          <TabsTrigger value="cadencia" className="min-w-max whitespace-nowrap">
            <CalendarClock className="h-4 w-4 mr-1.5" />
            Cadência
          </TabsTrigger>
          <TabsTrigger value="testar" className="min-w-max whitespace-nowrap">
            <PhoneCall className="h-4 w-4 mr-1.5" />
            Testar Ligação
          </TabsTrigger>
        </TabsList>

        {/* ─── Cadência Tab ─── */}
        <TabsContent value="cadencia" className="space-y-6 mt-4">
          {/* Recorrência */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><CalendarClock className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg">Controle de Cadência</CardTitle>
                    <CardDescription>Defina a recorrência e horários dos disparos de ligação</CardDescription>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Data de Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Data de Término</Label><Input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>A cada X Dia(s)</Label><Input type="number" min={1} max={30} value={frequenciaDias} onChange={e => setFrequenciaDias(Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={horario} onChange={e => setHorario(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Dias da semana</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DIAS_SEMANA.map(dia => {
                      const isActive = diasAtivos.includes(dia.key);
                      return (
                        <button key={dia.key} type="button" onClick={() => toggleDia(dia.key)} title={dia.full}
                          className={cn("w-10 h-10 rounded-lg text-sm font-semibold transition-colors border",
                            isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input hover:border-primary/50"
                          )}>
                          {dia.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">D = Domingo, S = Segunda, T = Terça, Q = Quarta, Q = Quinta, S = Sexta, S = Sábado</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Parâmetros da Query */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Settings2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-lg">Parâmetros da Query</CardTitle>
                  <CardDescription>Filtros aplicados à base de ligação para seleção de contatos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* id_evento tags */}
              <div className="space-y-2">
                <Label>id_evento</Label>
                <div className="flex gap-2">
                  <Input placeholder="Ex: 248" value={eventTagInput} onChange={e => setEventTagInput(e.target.value)} onKeyDown={handleEventTagKeyDown} className="flex-1" />
                  <Button type="button" size="icon" variant="outline" onClick={addEventTag}><Plus className="h-4 w-4" /></Button>
                </div>
                {eventTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {eventTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        {tag}
                        <button type="button" onClick={() => removeEventTag(tag)} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* num_tentativas */}
              <div className="space-y-1.5">
                <Label>num_tentativas (limite máximo)</Label>
                <Input type="number" min={0} max={10} value={numTentativas} onChange={e => setNumTentativas(Number(e.target.value))} />
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Crescente (ASC)</SelectItem>
                    <SelectItem value="DESC">Decrescente (DESC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Salvar */}
          <Button onClick={handleSaveCadencia} disabled={saving} size="lg" className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </TabsContent>

        {/* ─── Testar Ligação Tab ─── */}
        <TabsContent value="testar" className="space-y-6 mt-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" />
                Teste Rápido de Ligação
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione contatos para testar a ligação rapidamente com o agente selecionado
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={limparFormulario}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>

          {/* Info do Agente */}
          {selectedPri && (
            <Card className="bg-muted/30 border-dashed shadow-sm">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <div><span className="text-muted-foreground">Agente:</span> <span className="font-medium">{selectedPri.nome}</span></div>
                  <div><span className="text-muted-foreground">Telefone PRI:</span> <span className="font-mono font-medium">{telefonePri}</span></div>
                  {selectedPri.dealer_id && <div><span className="text-muted-foreground">Dealer ID:</span> <span className="font-mono">{selectedPri.dealer_id}</span></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seletor de Evento */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Evento para Teste
              </CardTitle>
              <CardDescription>Selecione o evento vinculado à ligação de teste</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedPriId ? (
                <p className="text-sm text-muted-foreground">Selecione um agente acima para carregar os eventos.</p>
              ) : loadingEventos ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...</div>
              ) : eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento encontrado para este agente.</p>
              ) : (
                <Select value={eventoSelecionado} onValueChange={setEventoSelecionado}>
                  <SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger>
                  <SelectContent>
                    {eventos.map((evento) => (
                      <SelectItem key={evento.id} value={evento.id}>
                        <div className="flex items-center gap-2">
                          <span>{evento.nome}</span>
                          <Badge variant={evento.evt_status === 'ativo' ? 'default' : 'secondary'} className="text-xs">
                            {evento.evt_status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">(ID: {evento.id_evento})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Lista de Contatos */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Contatos para Teste
                  {contatosPreenchidos > 0 && <Badge variant="secondary" className="ml-2">{contatosPreenchidos} preenchido(s)</Badge>}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={adicionarContato}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </div>
              <CardDescription>Insira nome e telefone dos contatos que receberão a ligação de teste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contatos.map((contato, index) => (
                <div key={contato.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-sm font-medium text-primary shrink-0">{index + 1}</div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`nome-${contato.id}`} className="text-xs text-muted-foreground">Nome</Label>
                      <Input id={`nome-${contato.id}`} value={contato.nome} onChange={(e) => atualizarContato(contato.id, "nome", e.target.value)} placeholder="Nome do contato" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor={`tel-${contato.id}`} className="text-xs text-muted-foreground">Telefone</Label>
                      <Input id={`tel-${contato.id}`} value={contato.telefone} onChange={(e) => atualizarContato(contato.id, "telefone", e.target.value)} placeholder="(00) 00000-0000" className="mt-1" />
                    </div>
                  </div>
                  {contatos.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removerContato(contato.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t">
            <Button onClick={handleConfirmar} disabled={confirmando || contatosPreenchidos === 0 || !selectedPriId} className="w-full sm:flex-1" variant={baseConfirmada ? "outline" : "default"}>
              {confirmando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Criando base...</> : baseConfirmada ? <><CheckCircle className="h-4 w-4 mr-2 text-green-500" />Base Confirmada</> : <><CheckCircle className="h-4 w-4 mr-2" />Confirmar Base</>}
            </Button>
            <Button onClick={handleDisparar} disabled={disparando || contatosPreenchidos === 0 || !selectedPriId} className="w-full sm:flex-1">
              {disparando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Disparando...</> : <><PhoneCall className="h-4 w-4 mr-2" />Disparar Ligação</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            💡 Você pode confirmar a base primeiro ou disparar diretamente. O disparo também cria a base automaticamente se necessário.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

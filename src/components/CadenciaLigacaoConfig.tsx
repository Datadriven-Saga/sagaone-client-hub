import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Phone, Settings2, CalendarClock, Loader2, X, PhoneCall, Plus, UserPlus, Trash2, RefreshCw, CheckCircle, Calendar, Send, MessageSquare, User } from "lucide-react";
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

interface EmpresaComWhatsapp {
  empresa_id: string;
  empresa_nome: string;
  marca?: string;
  uf?: string;
  crm_id?: string;
  telefone_whatsapp: string;
  telefone_ligacao?: string;
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
  const [horarioInicio, setHorarioInicio] = useState("07:45");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);

  // Cadência query params
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [showInativos, setShowInativos] = useState(false);
  const [numTentativas, setNumTentativas] = useState(2);
  const [evtStatus, setEvtStatus] = useState(true);
  const [ligacaoAtendida, setLigacaoAtendida] = useState(false);
  const [statusAgendado, setStatusAgendado] = useState(false);
  const [orderBy, setOrderBy] = useState<"ASC" | "DESC">("ASC");

  // ─── Testar state ───
  const [testarSelectedPriId, setTestarSelectedPriId] = useState("");
  const testarSelectedPri = priAgents.find(a => a.id === testarSelectedPriId);
  const testarTelefonePri = testarSelectedPri?.telefone || "";
  const [contatos, setContatos] = useState<ContatoTeste[]>([
    { id: crypto.randomUUID(), nome: "", telefone: "" }
  ]);
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [baseConfirmada, setBaseConfirmada] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>("");

  // ─── Envio Mensagem state ───
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgIdEvento, setMsgIdEvento] = useState("");
  const [msgEventIdMaia, setMsgEventIdMaia] = useState("");
  const [msgStatusAgendado, setMsgStatusAgendado] = useState(false);
  const [msgEvtStatus, setMsgEvtStatus] = useState(true);
  const [msgCodigoProposta, setMsgCodigoProposta] = useState(false);
  const [msgTelefonePriWhatsapp, setMsgTelefonePriWhatsapp] = useState("");
  const [msgDealerId, setMsgDealerId] = useState("");
  const [msgTelefonePriLigacao, setMsgTelefonePriLigacao] = useState("");

  // ─── Envio Mensagem: Empresa selector ───
  const [empresasWhatsapp, setEmpresasWhatsapp] = useState<EmpresaComWhatsapp[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [showEmpresaDropdown, setShowEmpresaDropdown] = useState(false);

  // ─── Envio Mensagem: Agente Ligação events ───
  const { data: msgEventosData = [], isLoading: loadingMsgEventos } = usePriLigacaoEventos(msgTelefonePriLigacao);
  const msgEventos = useMemo<EventoPriVoz[]>(() => {
    return (msgEventosData || []).map((evt: any) => {
      const rawStatus = evt?.evt_status ?? evt?.status;
      const isAtivo = rawStatus === true || String(rawStatus).toLowerCase() === "ativo" || String(rawStatus).toLowerCase() === "true" || rawStatus === "1" || rawStatus === 1;
      return {
        id: String(evt.id_evento || evt.id),
        id_evento: evt.id_evento || evt.id,
        nome: evt.nome || evt.name || `Evento ${evt.id_evento}`,
        evt_status: isAtivo ? "ativo" : "inativo",
      };
    });
  }, [msgEventosData]);
  const msgEventosAtivos = useMemo(() => msgEventos.filter(e => e.evt_status === "ativo"), [msgEventos]);

  const empresaDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (empresaDropdownRef.current && !empresaDropdownRef.current.contains(e.target as Node)) {
        setShowEmpresaDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Events from selected Pri (Cadência tab)
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

  // Events from selected Pri (Testar tab)
  const { data: testarEventosData = [], isLoading: loadingTestarEventos } = usePriLigacaoEventos(testarTelefonePri);

  const testarEventos = useMemo<EventoPriVoz[]>(() => {
    return (testarEventosData || []).map((evt: any) => {
      const rawStatus = evt?.evt_status ?? evt?.status;
      const isAtivo = rawStatus === true || String(rawStatus).toLowerCase() === "ativo" || String(rawStatus).toLowerCase() === "true" || rawStatus === "1" || rawStatus === 1;
      return {
        id: String(evt.id_evento || evt.id),
        id_evento: evt.id_evento || evt.id,
        nome: evt.nome || evt.name || `Evento ${evt.id_evento}`,
        evt_status: isAtivo ? "ativo" : "inativo",
      };
    });
  }, [testarEventosData]);

  // Auto-select first active event for testar
  useEffect(() => {
    if (eventoSelecionado) return;
    if (testarEventos.length === 0) return;
    const eventoAtivo = testarEventos.find((e) => e.evt_status === "ativo");
    setEventoSelecionado((eventoAtivo || testarEventos[0]).id);
  }, [testarEventos, eventoSelecionado]);

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

  // Reset when cadência pri changes
  useEffect(() => {
    setSelectedEventIds([]);
  }, [selectedPriId]);

  // Reset when testar pri changes
  useEffect(() => {
    setEventoSelecionado("");
    setContatos([{ id: crypto.randomUUID(), nome: "", telefone: "" }]);
    setBaseConfirmada(false);
  }, [testarSelectedPriId]);

  // ─── Fetch empresas with Pri-WhatsApp ───
  useEffect(() => {
    async function fetchEmpresasComWhatsapp() {
      setLoadingEmpresas(true);
      try {
        // Fetch all active agents with phone
        const { data: agentes, error: agErr } = await supabase
          .from("agentes_ia")
          .select("id, nome, telefone, empresa_id")
          .eq("ativo", true)
          .not("telefone", "is", null);
        if (agErr) throw agErr;

        // Fetch all agent-empresa links
        const { data: agLinks, error: linkErr } = await supabase
          .from("agente_empresas")
          .select("agente_id, empresa_id, status")
          .in("status", ["ativo", "pendente"]);
        if (linkErr) throw linkErr;

        // Build a map: empresa_id -> list of agent ids linked
        const empresaAgentMap = new Map<string, Set<string>>();
        for (const link of (agLinks || [])) {
          if (!empresaAgentMap.has(link.empresa_id)) empresaAgentMap.set(link.empresa_id, new Set());
          empresaAgentMap.get(link.empresa_id)!.add(link.agente_id);
        }

        // Classify agents
        const allAgents = agentes || [];
        const isWhatsapp = (a: any) => String(a.nome || "").toLowerCase().includes("whatsapp") && a.telefone;
        const isLigacao = (a: any) => {
          const nome = String(a.nome || "").toLowerCase();
          return (nome.includes("ligação") || nome.includes("ligacao") || nome.includes("ligaçao") || nome.includes("pri(ligação)") || nome.includes("pri(ligacao)")) && a.telefone;
        };

        // Find empresa IDs that have a whatsapp agent (via direct empresa_id or agente_empresas link)
        const getEmpresaIdsForAgent = (agent: any): string[] => {
          const ids: string[] = [];
          if (agent.empresa_id) ids.push(agent.empresa_id);
          for (const [empId, agentIds] of empresaAgentMap.entries()) {
            if (agentIds.has(agent.id) && !ids.includes(empId)) ids.push(empId);
          }
          return ids;
        };

        // Build map: empresa_id -> { whatsapp agent, ligacao agent }
        const empresaMap = new Map<string, { whatsapp?: any; ligacao?: any }>();

        for (const agent of allAgents) {
          const empIds = getEmpresaIdsForAgent(agent);
          for (const empId of empIds) {
            if (!empresaMap.has(empId)) empresaMap.set(empId, {});
            const entry = empresaMap.get(empId)!;
            if (isWhatsapp(agent) && !entry.whatsapp) entry.whatsapp = agent;
            if (isLigacao(agent) && !entry.ligacao) entry.ligacao = agent;
          }
        }

        // Filter only empresas that have whatsapp agent
        const empresaIdsWithWhatsapp = [...empresaMap.entries()]
          .filter(([, v]) => v.whatsapp)
          .map(([id]) => id);

        if (empresaIdsWithWhatsapp.length === 0) { setEmpresasWhatsapp([]); setLoadingEmpresas(false); return; }

        const { data: empresas, error: empErr } = await supabase
          .from("empresas")
          .select("id, nome_empresa, marca, uf, crm_id")
          .in("id", empresaIdsWithWhatsapp);
        if (empErr) throw empErr;

        const result: EmpresaComWhatsapp[] = [];
        for (const emp of (empresas || [])) {
          const agents = empresaMap.get(emp.id);
          if (agents?.whatsapp) {
            result.push({
              empresa_id: emp.id,
              empresa_nome: emp.nome_empresa || "Sem nome",
              marca: emp.marca || undefined,
              uf: emp.uf || undefined,
              crm_id: emp.crm_id || undefined,
              telefone_whatsapp: String(agents.whatsapp.telefone).replace(/\D/g, ""),
              telefone_ligacao: agents.ligacao ? String(agents.ligacao.telefone).replace(/\D/g, "") : undefined,
            });
          }
        }
        result.sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome));
        setEmpresasWhatsapp(result);
      } catch (err) {
        console.error("Erro ao buscar empresas com WhatsApp:", err);
      } finally {
        setLoadingEmpresas(false);
      }
    }
    fetchEmpresasComWhatsapp();
  }, []);

  const handleSelectEmpresa = (emp: EmpresaComWhatsapp) => {
    setSelectedEmpresaId(emp.empresa_id);
    setMsgTelefonePriWhatsapp(emp.telefone_whatsapp);
    setMsgDealerId(emp.crm_id || "");
    setMsgTelefonePriLigacao(emp.telefone_ligacao || "");
    setMsgIdEvento("");
    setEmpresaSearch(emp.empresa_nome);
    setShowEmpresaDropdown(false);
  };

  const filteredEmpresas = useMemo(() => {
    if (!empresaSearch.trim()) return empresasWhatsapp;
    const q = empresaSearch.toLowerCase();
    return empresasWhatsapp.filter(e =>
      e.empresa_nome.toLowerCase().includes(q) ||
      (e.crm_id && e.crm_id.toLowerCase().includes(q)) ||
      (e.marca && e.marca.toLowerCase().includes(q)) ||
      (e.uf && e.uf.toLowerCase().includes(q))
    );
  }, [empresasWhatsapp, empresaSearch]);

  // ─── Cadência helpers ───
  const toggleEventId = (id: number) => {
    setSelectedEventIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };
  const toggleDia = (key: string) => setDiasAtivos(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);

  const filteredEventos = useMemo(() => {
    if (showInativos) return eventos;
    return eventos.filter(evt => evt.evt_status === "ativo");
  }, [eventos, showInativos]);

  const handleSaveCadencia = async () => {
    if (selectedEventIds.length === 0) { toast({ title: "Selecione ao menos um evento", variant: "destructive" }); return; }
    if (!telefonePri) { toast({ title: "Selecione um agente Pri", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload = {
        id_evento: selectedEventIds.join(", "),
        telefone_pri: telefonePri,
        evt_status: evtStatus,
        num_tentativas: numTentativas,
        ligacao_atendida: ligacaoAtendida,
        status_agendado: statusAgendado,
        order_by: orderBy,
        recorrencia: recorrenciaAtiva ? {
          data_inicio: dataInicio,
          data_termino: dataTermino,
          horario_inicio: horarioInicio,
          horario_fim: horarioFim,
          dias_semana: diasAtivos,
        } : null,
      };
      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: { ...payload, _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/cadencia_ligacao" },
      });
      if (error) throw error;
      toast({ title: "Cadência configurada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao configurar", description: err.message || "Tente novamente.", variant: "destructive" });
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
    const eventoEscolhido = testarEventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) return;

    setConfirmando(true);
    try {
      const payload: Record<string, any> = {
        contatos: contatosParaEnviar,
        id_evento: eventoEscolhido.id_evento,
        telefone_pri: testarTelefonePri,
        loja: testarSelectedPri?.nome || 'Teste Rápido',
        sync_external: true,
      };
      if (testarSelectedPri?.empresa_id) payload.empresa_id = testarSelectedPri.empresa_id;

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
    if (!testarTelefonePri) { toast({ title: "Selecione um agente Pri", variant: "destructive" }); return; }
    if (!eventoSelecionado) { toast({ title: "Selecione um evento", variant: "destructive" }); return; }
    const eventoEscolhido = testarEventos.find(e => e.id === eventoSelecionado);
    if (!eventoEscolhido) return;

    if (!baseConfirmada) {
      toast({ title: "Confirme a base primeiro", description: "Clique em 'Confirmar Base' antes de disparar a ligação.", variant: "destructive" });
      return;
    }

    setDisparando(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: { endpoint: 'dispara-ligacao', telefone_pri: testarTelefonePri, id_evento: eventoEscolhido.id_evento, contatos: contatosParaEnviar },
      });
      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data?.message || data?.error || "Falha no disparo");
      }
      toast({ title: "Disparo realizado com sucesso!", description: data?.message || `Ligação para ${contatosParaEnviar.length} contato(s) confirmada pelo servidor.` });
    } catch (error: any) {
      toast({ title: "Erro ao disparar", description: error.message, variant: "destructive" });
    } finally {
      setDisparando(false);
    }
  };

  // ─── Envio Mensagem handler ───
  const handleDisparoMensagem = async () => {
    if (!msgTelefonePriWhatsapp.trim()) {
      toast({ title: "Selecione uma empresa", variant: "destructive" });
      return;
    }
    setSendingMsg(true);
    try {
      const payload = {
        id_evento: msgIdEvento,
        event_id_maia: msgEventIdMaia,
        status_agendado: msgStatusAgendado,
        evt_status: msgEvtStatus,
        codigo_proposta: msgCodigoProposta,
        telefone_pri_whatsapp: msgTelefonePriWhatsapp.replace(/\D/g, ""),
        dealerid: msgDealerId.trim(),
      };
      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: { ...payload, _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/envia_mensagem" },
      });
      if (error) throw error;
      toast({ title: "Mensagens disparadas com sucesso!", description: "O processo de envio foi iniciado." });
    } catch (err: any) {
      toast({ title: "Erro ao disparar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSendingMsg(false);
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
              <CardTitle className="text-lg">Painel de Configuração de Agentes</CardTitle>
              <CardDescription>Configure cadências de ligação, teste ligações e dispare mensagens em massa</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tabs: Cadência | Testar Ligação | Envio de Mensagem */}
      <Tabs defaultValue="cadencia" className="min-w-0">
        <TabsList className="flex-nowrap overflow-x-auto">
          <TabsTrigger value="cadencia" className="min-w-max whitespace-nowrap">
            <CalendarClock className="h-4 w-4 mr-1.5" />
            Cadência
          </TabsTrigger>
          <TabsTrigger value="testar" className="min-w-max whitespace-nowrap">
            <PhoneCall className="h-4 w-4 mr-1.5" />
            Testar Ligação
          </TabsTrigger>
          <TabsTrigger value="envio-mensagem" className="min-w-max whitespace-nowrap">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Envio de Mensagem
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════
            TAB 1: CADÊNCIA
            ═══════════════════════════════════════════════ */}
        <TabsContent value="cadencia" className="space-y-6 mt-4">
          {/* Seleção de Pri para Cadência */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Agente Pri (Ligação)</CardTitle>
              </div>
              <CardDescription>Selecione o agente para configurar a cadência</CardDescription>
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
                  <div className="space-y-1.5"><Label>Horário de Início</Label><Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Horário de Fim</Label><Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} /></div>
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
              {/* Eventos checkbox list */}
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...
                  </div>
                ) : eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento encontrado para este agente.</p>
                ) : filteredEventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento ativo encontrado. Ative "Mostrar inativos" para ver todos.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto rounded-lg border p-3">
                      {filteredEventos.map(evt => {
                        const isChecked = selectedEventIds.includes(Number(evt.id_evento));
                        return (
                          <label
                            key={evt.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors",
                              isChecked ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleEventId(Number(evt.id_evento))}
                            />
                            <span className="text-sm font-medium">{evt.nome}</span>
                            <Badge variant="outline" className="ml-auto text-xs">{evt.id_evento}</Badge>
                          </label>
                        );
                      })}
                    </div>
                    {selectedEventIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedEventIds.length} evento(s) selecionado(s)</p>
                    )}
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
                    <SelectItem value="ASC">Crescente (ASC) — Menor número de tentativas primeiro</SelectItem>
                    <SelectItem value="DESC">Decrescente (DESC) — Maior número de tentativas primeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Configurar Cadência */}
          <Button onClick={handleSaveCadencia} disabled={saving} size="lg" className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Configurar Cadência
          </Button>
        </TabsContent>

        {/* ═══════════════════════════════════════════════
            TAB 2: TESTAR LIGAÇÃO
            ═══════════════════════════════════════════════ */}
        <TabsContent value="testar" className="space-y-6 mt-4">
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
              <RefreshCw className="h-4 w-4 mr-2" /> Limpar
            </Button>
          </div>

          {/* Seleção de Pri para Testar */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Agente Pri (Ligação)</CardTitle>
              </div>
              <CardDescription>Selecione o agente para testar ligações e carregar os eventos</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando agentes...
                </div>
              ) : priAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum agente Pri encontrado.</p>
              ) : (
                <Select value={testarSelectedPriId} onValueChange={setTestarSelectedPriId}>
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

          {testarSelectedPri && (
            <Card className="bg-muted/30 border-dashed shadow-sm">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <div><span className="text-muted-foreground">Agente:</span> <span className="font-medium">{testarSelectedPri.nome}</span></div>
                  <div><span className="text-muted-foreground">Telefone PRI:</span> <span className="font-mono font-medium">{testarTelefonePri}</span></div>
                  {testarSelectedPri.dealer_id && <div><span className="text-muted-foreground">Dealer ID:</span> <span className="font-mono">{testarSelectedPri.dealer_id}</span></div>}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Evento para Teste
              </CardTitle>
              <CardDescription>Selecione o evento vinculado à ligação de teste</CardDescription>
            </CardHeader>
            <CardContent>
              {!testarSelectedPriId ? (
                <p className="text-sm text-muted-foreground">Selecione um agente acima para carregar os eventos.</p>
              ) : loadingTestarEventos ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...</div>
              ) : testarEventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento encontrado para este agente.</p>
              ) : (
                <Select value={eventoSelecionado} onValueChange={setEventoSelecionado}>
                  <SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger>
                  <SelectContent>
                    {testarEventos.map((evento) => (
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

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Contatos para Teste
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

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t">
            <Button onClick={handleConfirmar} disabled={confirmando || contatosPreenchidos === 0 || !testarSelectedPriId} className="w-full sm:flex-1" variant={baseConfirmada ? "outline" : "default"}>
              {confirmando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Criando base...</> : baseConfirmada ? <><CheckCircle className="h-4 w-4 mr-2 text-green-500" />Base Confirmada</> : <><CheckCircle className="h-4 w-4 mr-2" />Confirmar Base</>}
            </Button>
            <Button onClick={handleDisparar} disabled={disparando || contatosPreenchidos === 0 || !testarSelectedPriId || !baseConfirmada} className="w-full sm:flex-1">
              {disparando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Disparando...</> : <><PhoneCall className="h-4 w-4 mr-2" />Disparar Ligação</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            💡 Confirme a base primeiro, depois clique em Disparar Ligação.
          </p>
        </TabsContent>

        {/* ═══════════════════════════════════════════════
            TAB 3: ENVIO DE MENSAGEM
            ═══════════════════════════════════════════════ */}
        <TabsContent value="envio-mensagem" className="space-y-6 mt-4">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Disparo de Mensagens em Massa
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure filtros e dispare mensagens via webhook independente da cadência de ligação
            </p>
          </div>

          {/* Seleção de Empresa (Pri-WhatsApp) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><User className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-lg">Campos de Identificação</CardTitle>
                  <CardDescription>Selecione a empresa para preencher automaticamente todos os campos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Empresa searchable dropdown */}
              <div className="space-y-1.5">
                <Label>Empresa (Pri - WhatsApp ativo)</Label>
                {loadingEmpresas ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
                  </div>
                ) : (
                  <div className="relative" ref={empresaDropdownRef}>
                    <Input
                      placeholder="Pesquisar empresa por nome, CRM ID, marca ou UF..."
                      value={empresaSearch}
                      onChange={e => { setEmpresaSearch(e.target.value); setShowEmpresaDropdown(true); }}
                      onFocus={() => setShowEmpresaDropdown(true)}
                    />
                    {showEmpresaDropdown && filteredEmpresas.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                        {filteredEmpresas.map(emp => (
                          <button
                            key={emp.empresa_id}
                            type="button"
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0",
                              selectedEmpresaId === emp.empresa_id && "bg-accent"
                            )}
                            onClick={() => handleSelectEmpresa(emp)}
                          >
                            <div className="font-medium text-foreground">{emp.empresa_nome}</div>
                            <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                              {emp.marca && <span>{emp.marca}</span>}
                              {emp.uf && <span>• {emp.uf}</span>}
                              {emp.crm_id && <span>• CRM: {emp.crm_id}</span>}
                              <span>• Tel WhatsApp: {emp.telefone_whatsapp}</span>
                              {emp.telefone_ligacao && <span>• Tel Ligação: {emp.telefone_ligacao}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showEmpresaDropdown && filteredEmpresas.length === 0 && empresaSearch.trim() && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
                        Nenhuma empresa encontrada
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-filled fields (read-only display) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>telefone_pri_whatsapp</Label>
                  <Input
                    value={msgTelefonePriWhatsapp}
                    readOnly
                    placeholder="Preenchido ao selecionar empresa"
                    className={cn("bg-muted/50", msgTelefonePriWhatsapp && "border-primary/50")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>dealerid (CRM ID)</Label>
                  <Input
                    value={msgDealerId}
                    readOnly
                    placeholder="Preenchido ao selecionar empresa"
                    className={cn("bg-muted/50", msgDealerId && "border-primary/50")}
                  />
                </div>
              </div>

              {/* Agente de Ligação auto-filled */}
              <div className="space-y-1.5">
                <Label>Agente Pri (Ligação) da loja</Label>
                <Input
                  value={msgTelefonePriLigacao ? `Pri(Ligação) — ${msgTelefonePriLigacao}` : ""}
                  readOnly
                  placeholder="Preenchido ao selecionar empresa"
                  className={cn("bg-muted/50", msgTelefonePriLigacao && "border-primary/50")}
                />
                {selectedEmpresaId && !msgTelefonePriLigacao && (
                  <p className="text-xs text-amber-500">Nenhum agente de ligação encontrado para esta loja.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Settings2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-lg">Configuração de Filtros</CardTitle>
                  <CardDescription>Selecione o evento e configure os filtros do disparo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Eventos ativos do agente de ligação da loja */}
              <div className="space-y-2">
                <Label>Evento de Ligação (id_evento)</Label>
                {!msgTelefonePriLigacao ? (
                  <p className="text-sm text-muted-foreground py-2">Selecione uma empresa acima para carregar os eventos.</p>
                ) : loadingMsgEventos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...
                  </div>
                ) : msgEventosAtivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum evento ativo encontrado para este agente.</p>
                ) : (
                  <Select
                    value={msgIdEvento}
                    onValueChange={(val) => setMsgIdEvento(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um evento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {msgEventosAtivos.map(evt => (
                        <SelectItem key={evt.id} value={evt.id}>
                          {evt.nome} — ID: {evt.id_evento}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* ID Evento Maia (manual) */}
              <div className="space-y-1.5">
                <Label>ID do Evento Maia (m.event_id)</Label>
                <Input value={msgEventIdMaia} onChange={e => setMsgEventIdMaia(e.target.value)} placeholder="Ex: 232" />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="msg-status-agendado" className="text-sm">status_agendado</Label>
                  <Switch id="msg-status-agendado" checked={msgStatusAgendado} onCheckedChange={setMsgStatusAgendado} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="msg-evt-status" className="text-sm">evt_status</Label>
                  <Switch id="msg-evt-status" checked={msgEvtStatus} onCheckedChange={setMsgEvtStatus} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="msg-codigo-proposta" className="text-sm">codigo_proposta</Label>
                  <Switch id="msg-codigo-proposta" checked={msgCodigoProposta} onCheckedChange={setMsgCodigoProposta} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ação */}
          <Button onClick={handleDisparoMensagem} disabled={sendingMsg} size="lg" className="w-full sm:w-auto">
            {sendingMsg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Disparar Mensagens em Massa
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

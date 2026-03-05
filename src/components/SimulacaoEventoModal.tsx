import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Send,
  MessageCircle,
  Calendar,
  DollarSign,
  HelpCircle,
  PhoneCall,
  PhoneOff,
  Phone,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// ── WhatsApp rates ──
const TAXAS_WA = {
  carregada: {
    entreguesBase: 0.95,
    lidasEntregues: 0.49,
    respondidasLidas: 0.13,
    agendadosRespondidas: 0.029 / (0.95 * 0.49 * 0.13),
  },
  gerada: {
    entreguesBase: 0.95,
    lidasEntregues: 0.60,
    respondidasLidas: 0.28,
    agendadosRespondidas: 0.36,
  },
};

const CUSTOS_WA = { marketing: 0.06, utility: 0.01 };

// ── Ligação rates ──
const LIGACAO = {
  base: 1000,
  taxaAtendimento: 0.10,
  custoNaoAtendida: 0.06,
  custoFixoAtendida: 0.06,
  custoPorMinuto: 0.15,
  minutosSimulacao: 1,
};

type Canal = "whatsapp" | "ligacao";
type AgendadosTipo = "utility" | "marketing";
type TipoBase = "carregada" | "gerada";

interface SimulacaoEventoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SimulacaoEventoModal({ isOpen, onClose }: SimulacaoEventoModalProps) {
  const [canal, setCanal] = useState<Canal>("whatsapp");

  // WhatsApp state
  const [agendadosDesejados, setAgendadosDesejados] = useState("");
  const [cadNaoRespondeu, setCadNaoRespondeu] = useState(true);
  const [cadAgendados, setCadAgendados] = useState(false);
  const [agendadosTipo, setAgendadosTipo] = useState<AgendadosTipo>("utility");
  const [tipoBase, setTipoBase] = useState<TipoBase>("carregada");

  // Ligação state
  const [baseLigacao, setBaseLigacao] = useState("");
  // Cotação
  const [cotacao, setCotacao] = useState<number | null>(null);
  const [cotacaoLoading, setCotacaoLoading] = useState(false);

  const fetchCotacao = async () => {
    setCotacaoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cotacao-dolar");
      if (error) throw error;
      setCotacao(data.cotacao);
    } catch {
      // fallback
      setCotacao(5.75);
    } finally {
      setCotacaoLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cotacao === null) fetchCotacao();
  }, [isOpen]);

  // ── WhatsApp calcs ──
  const waCalcs = useMemo(() => {
    const A = parseInt(agendadosDesejados) || 0;
    if (A <= 0) return null;
    const t = TAXAS_WA[tipoBase];
    const agendadosBase = t.entreguesBase * t.lidasEntregues * t.respondidasLidas * t.agendadosRespondidas;
    const base = A / agendadosBase;
    const entregues = base * t.entreguesBase;
    const lidas = entregues * t.lidasEntregues;
    const respondidas = lidas * t.respondidasLidas;
    const naoRespondidas = entregues - respondidas;

    const custoInicial = entregues * CUSTOS_WA.marketing;
    const custoAgendadosUnit = agendadosTipo === "utility" ? CUSTOS_WA.utility : CUSTOS_WA.marketing;
    const custoCadAgendados = cadAgendados ? A * custoAgendadosUnit : 0;
    const custoCadNaoResp = cadNaoRespondeu ? naoRespondidas * CUSTOS_WA.marketing : 0;
    const custoTotal = custoInicial + custoCadAgendados + custoCadNaoResp;

    return {
      base: Math.round(base),
      entregues: Math.round(entregues),
      lidas: Math.round(lidas),
      respondidas: Math.round(respondidas),
      agendados: A,
      naoRespondidas: Math.round(naoRespondidas),
      custoInicial,
      custoCadAgendados,
      custoCadNaoResp,
      custoTotal,
      volumeInicial: Math.round(entregues),
      volumeNaoResp: Math.round(naoRespondidas),
      custoAgendadosUnit,
      taxas: t,
      agendadosBase,
    };
  }, [agendadosDesejados, cadNaoRespondeu, cadAgendados, agendadosTipo, tipoBase]);

  // ── Ligação calcs ──
  const ligCalcs = useMemo(() => {
    const total = parseInt(baseLigacao) || 0;
    if (total <= 0) return null;
    const atendidas = Math.round(total * LIGACAO.taxaAtendimento);
    const naoAtendidas = total - atendidas;
    const custoNaoAtendidas = naoAtendidas * LIGACAO.custoNaoAtendida;
    const custoAtendidas = atendidas * (LIGACAO.custoFixoAtendida + LIGACAO.custoPorMinuto * LIGACAO.minutosSimulacao);
    const custoTotal = custoNaoAtendidas + custoAtendidas;
    return { total, atendidas, naoAtendidas, custoNaoAtendidas, custoAtendidas, custoTotal };
  }, [baseLigacao]);

  const custoTotalUSD = canal === "whatsapp" ? (waCalcs?.custoTotal ?? 0) : (ligCalcs?.custoTotal ?? 0);
  const custoTotalBRL = custoTotalUSD * (cotacao ?? 5.75);

  const formatUSD = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

  const showResults = (canal === "whatsapp" && waCalcs) || (canal === "ligacao" && ligCalcs);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Simulação de Evento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Canal selector */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </span>
                </SelectItem>
                <SelectItem value="ligacao">
                  <span className="flex items-center gap-2">
                    <PhoneCall className="h-3.5 w-3.5" /> Ligação
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ─── WhatsApp inputs ─── */}
          {canal === "whatsapp" && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="space-y-1.5 min-w-[160px] flex-1">
                  <Label htmlFor="agendados" className="text-sm font-medium">
                    Leads agendados desejados
                  </Label>
                  <Input
                    id="agendados"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Ex: 100"
                    value={agendadosDesejados}
                    onChange={(e) => setAgendadosDesejados(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 min-w-[180px] flex-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-sm font-medium">Tipo de base</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] text-xs">
                          <p className="font-semibold mb-1">Carregada</p>
                          <p className="mb-2">Base carregada pela equipe de CRM.</p>
                          <p className="font-semibold mb-1">Gerada</p>
                          <p>Base gerada por campanhas sobre o evento integradas no Mobigestor. Possui taxas de conversão superiores.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={tipoBase} onValueChange={(v) => setTipoBase(v as TipoBase)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carregada" className="text-xs">Carregada (CRM)</SelectItem>
                      <SelectItem value="gerada" className="text-xs">Gerada (Mobigestor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Cadências</Label>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox id="cad-nr" checked={cadNaoRespondeu} onCheckedChange={(v) => setCadNaoRespondeu(!!v)} />
                    <Label htmlFor="cad-nr" className="text-xs font-normal cursor-pointer">
                      Não respondeu
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">Marketing</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cad-ag" checked={cadAgendados} onCheckedChange={(v) => setCadAgendados(!!v)} />
                    <Label htmlFor="cad-ag" className="text-xs font-normal cursor-pointer">Agendados</Label>
                    <Select value={agendadosTipo} onValueChange={(v) => setAgendadosTipo(v as AgendadosTipo)}>
                      <SelectTrigger className="h-6 w-[110px] text-[10px] px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utility" className="text-xs">Utility</SelectItem>
                        <SelectItem value="marketing" className="text-xs">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] text-xs">
                          <p className="font-semibold mb-1">Template de Utilidade</p>
                          <p>Para aprovar como Utilidade, o template deve ser operacional e esperado pelo cliente: confirmar/lembrar presença (RSVP), reagendamento ou info do evento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Ligação input ─── */}
          {canal === "ligacao" && (
            <div className="space-y-1.5">
              <Label htmlFor="baseLigacao" className="text-sm font-medium">
                Total da base (pessoas)
              </Label>
              <Input
                id="baseLigacao"
                type="number"
                min={0}
                step={1}
                placeholder="Ex: 1000"
                value={baseLigacao}
                onChange={(e) => setBaseLigacao(e.target.value)}
                className="h-9"
              />
              {ligCalcs && (
                <p className="text-[11px] text-muted-foreground">
                  Taxa de atendimento: <span className="font-semibold text-foreground">{(LIGACAO.taxaAtendimento * 100).toFixed(0)}%</span> · Duração simulada: <span className="font-semibold text-foreground">{LIGACAO.minutosSimulacao} min</span>
                </p>
              )}
            </div>
          )}

          {/* ─── Results ─── */}
          {showResults && (
            <>
              {/* KPI Cards */}
              {canal === "whatsapp" && waCalcs && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: "Base", value: waCalcs.base, pct: "100%" },
                    { label: "Entregues", value: waCalcs.entregues, pct: `${(waCalcs.taxas.entreguesBase * 100).toFixed(0)}%` },
                    { label: "Lidas", value: waCalcs.lidas, pct: `${(waCalcs.taxas.lidasEntregues * 100).toFixed(0)}%` },
                    { label: "Respondidas", value: waCalcs.respondidas, pct: `${(waCalcs.taxas.respondidasLidas * 100).toFixed(0)}%` },
                    { label: "Agendados", value: waCalcs.agendados, pct: `${(waCalcs.agendadosBase * 100).toFixed(1)}%` },
                    { label: "Não Resp.", value: waCalcs.naoRespondidas, pct: null },
                  ].map((kpi) => (
                    <Card key={kpi.label} className="border">
                      <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
                        <p className="text-sm font-bold">{kpi.value.toLocaleString("pt-BR")}</p>
                        {kpi.pct && (
                          <p className="text-[10px] font-semibold text-primary">{kpi.pct}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {canal === "ligacao" && ligCalcs && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total", value: ligCalcs.total, pct: "100%" },
                    { label: "Atendidas", value: ligCalcs.atendidas, pct: `${(LIGACAO.taxaAtendimento * 100).toFixed(0)}%` },
                    { label: "Não Atendidas", value: ligCalcs.naoAtendidas, pct: `${((1 - LIGACAO.taxaAtendimento) * 100).toFixed(0)}%` },
                  ].map((kpi) => (
                    <Card key={kpi.label} className="border">
                      <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
                        <p className="text-sm font-bold">{kpi.value.toLocaleString("pt-BR")}</p>
                        <p className="text-[10px] font-semibold text-primary">{kpi.pct}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Cost table */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Custos Estimados (USD)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Disparo</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Volume</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Custo Unit.</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {canal === "whatsapp" && waCalcs && (
                        <>
                          <tr className="border-b">
                            <td className="py-2 px-3 text-xs">
                              Disparo Inicial
                              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Marketing</Badge>
                            </td>
                            <td className="py-2 px-3 text-xs text-right">{waCalcs.volumeInicial.toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-xs text-right">{formatUSD(CUSTOS_WA.marketing)}</td>
                            <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(waCalcs.custoInicial)}</td>
                          </tr>
                          {cadNaoRespondeu && (
                            <tr className="border-b">
                              <td className="py-2 px-3 text-xs">
                                Cadência – Não respondeu
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Marketing</Badge>
                              </td>
                              <td className="py-2 px-3 text-xs text-right">{waCalcs.volumeNaoResp.toLocaleString("pt-BR")}</td>
                              <td className="py-2 px-3 text-xs text-right">{formatUSD(CUSTOS_WA.marketing)}</td>
                              <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(waCalcs.custoCadNaoResp)}</td>
                            </tr>
                          )}
                          {cadAgendados && (
                            <tr className="border-b">
                              <td className="py-2 px-3 text-xs">
                                Cadência – Agendados
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">
                                  {agendadosTipo === "utility" ? "Utility" : "Marketing"}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-xs text-right">{waCalcs.agendados.toLocaleString("pt-BR")}</td>
                              <td className="py-2 px-3 text-xs text-right">{formatUSD(waCalcs.custoAgendadosUnit)}</td>
                              <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(waCalcs.custoCadAgendados)}</td>
                            </tr>
                          )}
                        </>
                      )}

                      {canal === "ligacao" && ligCalcs && (
                        <>
                          <tr className="border-b">
                            <td className="py-2 px-3 text-xs">Ligações não atendidas</td>
                            <td className="py-2 px-3 text-xs text-right">{ligCalcs.naoAtendidas.toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-xs text-right">{formatUSD(LIGACAO.custoNaoAtendida)}</td>
                            <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(ligCalcs.custoNaoAtendidas)}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-3 text-xs">Ligações atendidas ({LIGACAO.minutosSimulacao} min)</td>
                            <td className="py-2 px-3 text-xs text-right">{ligCalcs.atendidas.toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-xs text-right">
                              {formatUSD(LIGACAO.custoFixoAtendida + LIGACAO.custoPorMinuto * LIGACAO.minutosSimulacao)}
                            </td>
                            <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(ligCalcs.custoAtendidas)}</td>
                          </tr>
                        </>
                      )}

                      {/* Total USD */}
                      <tr className="bg-muted/30 border-b">
                        <td colSpan={3} className="py-2.5 px-3 text-xs font-semibold">Custo Total (USD)</td>
                        <td className="py-2.5 px-3 text-sm text-right font-bold text-primary">{formatUSD(custoTotalUSD)}</td>
                      </tr>

                      {/* Total BRL */}
                      <tr className="bg-muted/20">
                        <td colSpan={3} className="py-2 px-3 text-xs text-muted-foreground">
                          Custo total estimado em Real
                        </td>
                        <td className="py-2 px-3 text-xs text-right font-semibold text-muted-foreground">
                          {cotacaoLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin inline" />
                          ) : (
                            formatBRL(custoTotalBRL)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Cotação footnote */}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-muted-foreground">
                    Cotação utilizada: US$ 1.00 = {cotacaoLoading ? "..." : formatBRL(cotacao ?? 5.75)}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={fetchCotacao} disabled={cotacaoLoading}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${cotacaoLoading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Empty states */}
          {canal === "whatsapp" && !waCalcs && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="mx-auto h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Insira a quantidade de leads agendados desejados para ver a simulação.</p>
            </div>
          )}
          {canal === "ligacao" && !ligCalcs && (
            <div className="text-center py-8 text-muted-foreground">
              <PhoneCall className="mx-auto h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Insira o total da base para ver a simulação de custos.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

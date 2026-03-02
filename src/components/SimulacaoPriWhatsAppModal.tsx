import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Send, MessageCircle, Calendar, DollarSign, ArrowRight } from "lucide-react";

interface SimulacaoPriWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAXAS = {
  agendadosBase: 0.029,
  entreguesBase: 0.95,
  lidasEntregues: 0.49,
  respondidasLidas: 0.13,
};

const CUSTOS = {
  marketing: 0.06,
  utility: 0.01,
};

type AgendadosTipo = "utility" | "marketing";

export function SimulacaoPriWhatsAppModal({ isOpen, onClose }: SimulacaoPriWhatsAppModalProps) {
  const [agendadosDesejados, setAgendadosDesejados] = useState<string>("");
  const [cadNaoRespondeu, setCadNaoRespondeu] = useState(true);
  const [cadAgendados, setCadAgendados] = useState(false);
  const [agendadosTipo, setAgendadosTipo] = useState<AgendadosTipo>("utility");

  const calcs = useMemo(() => {
    const A = parseInt(agendadosDesejados) || 0;
    if (A <= 0) return null;

    const base = A / TAXAS.agendadosBase;
    const entregues = base * TAXAS.entreguesBase;
    const lidas = entregues * TAXAS.lidasEntregues;
    const respondidas = lidas * TAXAS.respondidasLidas;
    const naoRespondidas = entregues - respondidas;

    const custoInicial = entregues * CUSTOS.marketing;

    const custoAgendadosUnit = agendadosTipo === "utility" ? CUSTOS.utility : CUSTOS.marketing;
    const custoCadAgendados = cadAgendados ? A * custoAgendadosUnit : 0;
    const custoCadNaoResp = cadNaoRespondeu ? naoRespondidas * CUSTOS.marketing : 0;
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
    };
  }, [agendadosDesejados, cadNaoRespondeu, cadAgendados, agendadosTipo]);

  const funnelSteps = calcs ? [
    { label: "Base", value: calcs.base, icon: Users, pct: "100%" },
    { label: "Entregues", value: calcs.entregues, icon: Send, pct: `${(TAXAS.entreguesBase * 100).toFixed(0)}%` },
    { label: "Lidas", value: calcs.lidas, icon: MessageCircle, pct: `${(TAXAS.lidasEntregues * 100).toFixed(0)}%` },
    { label: "Respondidas", value: calcs.respondidas, icon: MessageCircle, pct: `${(TAXAS.respondidasLidas * 100).toFixed(0)}%` },
    { label: "Agendados", value: calcs.agendados, icon: Calendar, pct: `${(TAXAS.agendadosBase * 100).toFixed(1)}%` },
  ] : [];

  const formatUSD = (val: number) => `US$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Simulação PRI WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Entrada */}
          <div className="space-y-4">
            <div className="max-w-[260px] space-y-1.5">
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

            <div className="space-y-2">
              <Label className="text-sm font-medium">Cadências</Label>
              <div className="flex flex-col gap-2.5">
                {/* Cadência Não Respondeu */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cad-nr"
                    checked={cadNaoRespondeu}
                    onCheckedChange={(v) => setCadNaoRespondeu(!!v)}
                  />
                  <Label htmlFor="cad-nr" className="text-xs font-normal cursor-pointer">
                    Não respondeu
                    <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">Marketing</Badge>
                  </Label>
                </div>

                {/* Cadência Agendados */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cad-ag"
                    checked={cadAgendados}
                    onCheckedChange={(v) => setCadAgendados(!!v)}
                  />
                  <Label htmlFor="cad-ag" className="text-xs font-normal cursor-pointer">
                    Agendados
                  </Label>
                  <Select value={agendadosTipo} onValueChange={(v) => setAgendadosTipo(v as AgendadosTipo)}>
                    <SelectTrigger className="h-6 w-[110px] text-[10px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility" className="text-xs">Utility</SelectItem>
                      <SelectItem value="marketing" className="text-xs">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {calcs && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: "Base", value: calcs.base },
                  { label: "Entregues", value: calcs.entregues },
                  { label: "Lidas", value: calcs.lidas },
                  { label: "Respondidas", value: calcs.respondidas },
                  { label: "Agendados", value: calcs.agendados },
                  { label: "Não Resp.", value: calcs.naoRespondidas },
                ].map((kpi) => (
                  <Card key={kpi.label} className="border">
                    <CardContent className="p-2 text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
                      <p className="text-sm font-bold">{kpi.value.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Funil */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Funil Estimado</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {funnelSteps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-1">
                      <div className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-2 min-w-[70px]">
                        <step.icon className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                        <span className="text-xs font-semibold">{step.value.toLocaleString("pt-BR")}</span>
                        <span className="text-[10px] text-muted-foreground">{step.label}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">{step.pct}</Badge>
                      </div>
                      {i < funnelSteps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custos */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Custos Estimados (USD)</h4>
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
                      <tr className="border-b">
                        <td className="py-2 px-3 text-xs">
                          Disparo Inicial
                          <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Marketing</Badge>
                        </td>
                        <td className="py-2 px-3 text-xs text-right">{calcs.volumeInicial.toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-3 text-xs text-right">{formatUSD(CUSTOS.marketing)}</td>
                        <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(calcs.custoInicial)}</td>
                      </tr>
                      {cadNaoRespondeu && (
                        <tr className="border-b">
                          <td className="py-2 px-3 text-xs">
                            Cadência – Não respondeu
                            <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Marketing</Badge>
                          </td>
                          <td className="py-2 px-3 text-xs text-right">{calcs.volumeNaoResp.toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-3 text-xs text-right">{formatUSD(CUSTOS.marketing)}</td>
                          <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(calcs.custoCadNaoResp)}</td>
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
                          <td className="py-2 px-3 text-xs text-right">{calcs.agendados.toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-3 text-xs text-right">{formatUSD(calcs.custoAgendadosUnit)}</td>
                          <td className="py-2 px-3 text-xs text-right font-medium">{formatUSD(calcs.custoCadAgendados)}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="py-2.5 px-3 text-xs font-semibold">Custo Total</td>
                        <td className="py-2.5 px-3 text-sm text-right font-bold text-primary">{formatUSD(calcs.custoTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!calcs && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="mx-auto h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Insira a quantidade de leads agendados desejados para ver a simulação.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

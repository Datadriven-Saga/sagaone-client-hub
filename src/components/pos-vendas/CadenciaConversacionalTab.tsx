import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { usePatyAgentes, useFollowUpCadence } from "@/hooks/pos-vendas/usePosVendasData";

export function CadenciaConversacionalTab() {
  const { toast } = useToast();
  const { agentes, loading: loadingAgentes } = usePatyAgentes();
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const effectiveId = agenteId ?? agentes[0]?.id ?? null;
  const agente = agentes.find(a => a.id === effectiveId) ?? null;
  const telAgent = agente?.telefone ?? null;

  const { config, intervals, isDefault, save, loading } = useFollowUpCadence(telAgent);

  const [maxAttempts, setMaxAttempts] = useState(3);
  const [active, setActive] = useState(true);
  const [waits, setWaits] = useState<number[]>([4, 6, 12]);
  const [saving, setSaving] = useState(false);

  // Sincroniza com dados carregados
  useEffect(() => {
    if (!config) return;
    setMaxAttempts(config.max_attempts);
    setActive(config.active);
    const arr: number[] = [];
    for (let i = 0; i < config.max_attempts; i++) {
      const found = intervals.find(x => x.from_attempt === i);
      arr.push(found ? Math.round(found.wait_hours * 100) / 100 : 4);
    }
    setWaits(arr);
  }, [config, intervals]);

  // Ajusta tamanho do array de intervalos quando max_attempts muda
  useEffect(() => {
    setWaits(prev => {
      if (prev.length === maxAttempts) return prev;
      if (prev.length < maxAttempts) {
        return [...prev, ...Array(maxAttempts - prev.length).fill(prev[prev.length - 1] ?? 4)];
      }
      return prev.slice(0, maxAttempts);
    });
  }, [maxAttempts]);

  const totalHours = useMemo(() => waits.reduce((s, h) => s + (h || 0), 0), [waits]);

  if (!effectiveId) {
    return <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />;
  }

  if (!telAgent) {
    return (
      <div className="space-y-4">
        <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Este agente não possui telefone cadastrado. A cadência conversacional é chaveada pelo telefone do agente.</CardContent></Card>
      </div>
    );
  }

  const handleSave = async () => {
    if (waits.some(h => !h || h <= 0)) {
      toast({ title: "Intervalos inválidos", description: "Todos os intervalos devem ser maiores que zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await save({
        max_attempts: maxAttempts,
        active,
        intervals: waits.map((h, i) => ({ from_attempt: i, wait_hours: h })),
      });
      toast({ title: "Cadência salva" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Cadência Conversacional
            {isDefault && <Badge variant="secondary">usando DEFAULT</Badge>}
            {!active && <Badge variant="outline">inativa</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aplica-se após o cliente responder, valendo para Entregas e Agendamentos. Chaveada pelo telefone do agente ({telAgent}). Se não houver config própria, usa a linha <code>DEFAULT</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Configuração ativa</Label>
              <p className="text-xs text-muted-foreground">Quando inativa, o sistema cai no fallback DEFAULT.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="max-w-xs">
            <Label className="text-xs">Máximo de tentativas</Label>
            <Input
              type="number" min={1} max={20} value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground mt-1">Após esgotar, o follow-up é marcado como expirado.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Intervalos por tentativa (em horas)</Label>
            <p className="text-xs text-muted-foreground">
              <code>from_attempt = N</code> é o tempo de espera antes da próxima tentativa, contado a partir da tentativa N (0 = primeira entrada na fila).
            </p>
            <div className="grid gap-2">
              {waits.map((h, i) => (
                <div key={i} className="flex items-center gap-3 border rounded-md px-3 py-2">
                  <Badge variant="outline" className="font-mono">from_attempt = {i}</Badge>
                  <span className="text-xs text-muted-foreground">aguardar</span>
                  <Input
                    type="number" min={0.1} step={0.5} max={720}
                    className="w-28"
                    value={h}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setWaits(prev => prev.map((p, idx) => idx === i ? (isNaN(v) ? 0 : v) : p));
                    }}
                  />
                  <span className="text-xs text-muted-foreground">horas até a tentativa #{i + 2}</span>
                </div>
              ))}
            </div>
            {totalHours > 168 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Cadência total de {totalHours.toFixed(1)}h ({(totalHours / 24).toFixed(1)} dias).
              </p>
            )}
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <p className="font-medium">Exemplo de fluxo com esta configuração:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li>Lead entra no follow-up com tentativas = 0.</li>
              {waits.map((h, i) => (
                <li key={i}>tentativas = {i} → agenda +{h}h, dispara, incrementa para {i + 1}.</li>
              ))}
              <li>tentativas = {maxAttempts} → expirado, sai da fila.</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-1" /> Salvar Cadência
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
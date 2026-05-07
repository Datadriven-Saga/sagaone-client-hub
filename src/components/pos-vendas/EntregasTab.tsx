import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { TemplateSelectApproved } from "./TemplateSelectApproved";
import { GATILHOS_ENTREGA } from "@/constants/pos-vendas-gatilhos";
import { usePatyAgentes, usePatyTemplates, useGatilhosConfig } from "@/hooks/pos-vendas/usePosVendasData";

export function EntregasTab() {
  const { toast } = useToast();
  const { agentes, loading: loadingAgentes } = usePatyAgentes();
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const effectiveId = agenteId ?? agentes[0]?.id ?? null;
  const { templates } = usePatyTemplates(effectiveId, true);
  const { configs, upsert } = useGatilhosConfig(effectiveId);

  const getCfg = (slug: string) => configs.find(c => c.gatilho_slug === slug);

  const handleToggle = async (slug: string, ativo: boolean) => {
    const cfg = getCfg(slug);
    if (ativo && !cfg?.template_id) {
      toast({ title: "Selecione um template", description: "Vincule um template antes de ativar.", variant: "destructive" });
      return;
    }
    try { await upsert(slug, { ativo }); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const handleTemplate = async (slug: string, id: string | null) => {
    try { await upsert(slug, { template_id: id }); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />
      {effectiveId && (
        <div className="grid gap-4">
          {GATILHOS_ENTREGA.map(g => {
            const cfg = getCfg(g.slug);
            const ativo = cfg?.ativo ?? false;
            return (
              <Card key={g.slug} className={ativo ? "" : "opacity-70"}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {g.nome}
                      {ativo && <Badge>Ativo</Badge>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{g.descricao}</p>
                    <p className="text-xs text-muted-foreground font-mono">slug: {g.slug}</p>
                  </div>
                  <Switch checked={ativo} onCheckedChange={(v) => handleToggle(g.slug, v)} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label className="text-xs">Template vinculado</Label>
                  <TemplateSelectApproved
                    templates={templates}
                    value={cfg?.template_id ?? null}
                    onChange={(id) => handleTemplate(g.slug, id)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
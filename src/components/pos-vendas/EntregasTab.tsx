import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { TemplateSelectApproved } from "./TemplateSelectApproved";
import { GATILHOS_ENTREGA } from "@/constants/pos-vendas-gatilhos";
import { usePatyAgentes, usePatyTemplates } from "@/hooks/pos-vendas/usePosVendasData";
import { usePatyEntregasTemplates } from "@/hooks/pos-vendas/useEntregasData";

export function EntregasTab() {
  const { toast } = useToast();
  const { agentes, loading: loadingAgentes } = usePatyAgentes();
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const effectiveId = agenteId ?? agentes[0]?.id ?? null;
  const agente = agentes.find(a => a.id === effectiveId) ?? null;
  const agenteTelefone = agente?.telefone ?? null;

  const { templates } = usePatyTemplates(effectiveId, true);
  const { rows, upsert, desativar } = usePatyEntregasTemplates(agenteTelefone);

  // localId (UUID) -> template_id_pri
  const priById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) if (t.template_id_pri) m.set(t.id, String(t.template_id_pri));
    return m;
  }, [templates]);
  const idByPri = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) if (t.template_id_pri) m.set(String(t.template_id_pri), t.id);
    return m;
  }, [templates]);

  const findRow = (slug: string) => rows.find(r => r.slug === slug);

  const handleTemplate = async (slug: string, localId: string | null) => {
    const row = findRow(slug);
    const pri = localId ? priById.get(localId) : null;
    if (localId && !pri) {
      toast({ title: "Template sem ID PRI", description: "Sincronize o template com a Meta para obter o ID PRI.", variant: "destructive" });
      return;
    }
    try {
      await upsert({ slug, template_id: pri ?? "", ativo: row?.ativo ?? true });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (slug: string, ativo: boolean) => {
    const row = findRow(slug);
    if (ativo && !row?.template_id) {
      toast({ title: "Selecione um template", description: "Vincule um template antes de ativar.", variant: "destructive" });
      return;
    }
    try {
      // Toggle sempre dispara upsert-paty-entrega-template (ativar ou desativar),
      // espelhando o comportamento desejado no n8n. Não usa o endpoint de desativar
      // para evitar dependência de `id` numérico (que pode não existir se a busca falhar).
      await upsert({ slug, template_id: row?.template_id ?? "", ativo });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />
      {!agenteTelefone && effectiveId && (
        <p className="text-sm text-muted-foreground">Agente sem telefone configurado.</p>
      )}
      {agenteTelefone && (
        <div className="grid gap-4">
          {GATILHOS_ENTREGA.map(g => {
            const row = findRow(g.slug);
            const ativo = row?.ativo ?? false;
            const selectedLocalId = row?.template_id ? (idByPri.get(row.template_id) ?? null) : null;
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
                    value={selectedLocalId}
                    onChange={(id) => handleTemplate(g.slug, id)}
                  />
                  {row?.template_id && !selectedLocalId && (
                    <p className="text-xs text-muted-foreground">
                      Template configurado (ID PRI {row.template_id}) não foi encontrado na lista local.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
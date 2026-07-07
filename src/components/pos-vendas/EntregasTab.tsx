import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
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
  const { rowsBySlug, upsert, desativar, remover, addDraftSequencia, removeLocalRow } =
    usePatyEntregasTemplates(agenteTelefone);

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

  const getList = (slug: string) => rowsBySlug[slug] ?? [];

  const handleTemplateChange = async (slug: string, sequencia: number, localId: string | null) => {
    const list = getList(slug);
    const row = list.find(r => r.sequencia === sequencia);
    const pri = localId ? priById.get(localId) : null;
    if (localId && !pri) {
      toast({ title: "Template sem ID PRI", description: "Sincronize o template com a Meta para obter o ID PRI.", variant: "destructive" });
      return;
    }
    try {
      await upsert({
        slug,
        sequencia,
        template_id: pri ?? "",
        ativo: row?.ativo ?? true,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleCard = async (slug: string, ativo: boolean) => {
    const list = getList(slug);
    const primeira = list.find(r => r.sequencia === 0);
    if (ativo && !primeira?.template_id) {
      toast({
        title: "Selecione um template",
        description: "Selecione um template para o primeiro passo.",
        variant: "destructive",
      });
      return;
    }
    try {
      const salvas = list.filter(r => r.template_id && r.id && r.id > 0);
      if (!ativo) {
        // Desativar: chama endpoint dedicado para cada linha salva
        await Promise.all(salvas.map(r => desativar(r.id)));
      } else {
        // Ativar: propaga via upsert (endpoint externo cria/atualiza com ativo=true)
        await Promise.all(
          list
            .filter(r => r.template_id)
            .map(r => upsert({ slug, sequencia: r.sequencia, template_id: r.template_id, ativo: true }))
        );
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveSequencia = async (slug: string, row: { id: number; sequencia: number }) => {
    try {
      if (row.id && row.id > 0) {
        await remover(row.id);
      }
      removeLocalRow(slug, row.sequencia);
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
            const list = getList(g.slug);
            const ativo = list.some(r => r.ativo);
            return (
              <Card key={g.slug} className={ativo ? "" : "opacity-80"}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {g.nome}
                      {ativo && <Badge>Ativo</Badge>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{g.descricao}</p>
                    <p className="text-xs text-muted-foreground font-mono">slug: {g.slug}</p>
                  </div>
                  <Switch checked={ativo} onCheckedChange={(v) => handleToggleCard(g.slug, v)} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.map((row, index) => {
                    const selectedLocalId = row.template_id ? (idByPri.get(row.template_id) ?? null) : null;
                    const isFirst = index === 0;
                    return (
                      <div key={`${row.sequencia}-${row.id}`} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            Passo {index + 1}
                          </Label>
                          {!isFirst && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveSequencia(g.slug, { id: row.id, sequencia: row.sequencia })}
                              aria-label="Remover seguimento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className={isFirst ? "" : "text-sm"}>
                          <TemplateSelectApproved
                            templates={templates}
                            value={selectedLocalId}
                            onChange={(id) => handleTemplateChange(g.slug, row.sequencia, id)}
                          />
                        </div>
                        {row.template_id && !selectedLocalId && (
                          <p className="text-xs text-muted-foreground">
                            Template configurado (ID PRI {row.template_id}) não foi encontrado na lista local.
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => addDraftSequencia(g.slug)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
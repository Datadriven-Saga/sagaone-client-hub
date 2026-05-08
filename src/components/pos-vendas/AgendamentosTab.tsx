import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { TemplateSelectApproved } from "./TemplateSelectApproved";
import { CUSTO_POR_CATEGORIA } from "@/constants/pos-vendas-gatilhos";
import { usePatyAgentes, usePatyTemplates, useCadenciaConfig } from "@/hooks/pos-vendas/usePosVendasData";
import type { CadenciaConfig, FollowupConfig, PatyTemplate } from "@/types/pos-vendas";

function custoOf(templates: PatyTemplate[], id: string | null) {
  if (!id) return 0;
  const t = templates.find(x => x.id === id);
  if (!t) return 0;
  const cat = (t.category_meta || t.categoria || "").toUpperCase();
  return CUSTO_POR_CATEGORIA[cat] ?? 0;
}

export function AgendamentosTab() {
  const { toast } = useToast();
  const { agentes, loading: loadingAgentes } = usePatyAgentes();
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const effectiveId = agenteId ?? agentes[0]?.id ?? null;
  const { templates } = usePatyTemplates(effectiveId, true);
  const { cadencia, save, reload } = useCadenciaConfig(effectiveId);
  const [draft, setDraft] = useState<CadenciaConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(cadencia); }, [cadencia]);

  if (!effectiveId || !draft) {
    return <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />;
  }

  const upd = (p: Partial<CadenciaConfig>) => setDraft({ ...draft, ...p });
  const addF = () => upd({ followups: [...draft.followups, { ordem: draft.followups.length + 1, template_id: null, intervalo_horas: 24, ativo: true }] });
  const rmF = (i: number) => upd({ followups: draft.followups.filter((_, idx) => idx !== i) });
  const updF = (i: number, p: Partial<FollowupConfig>) => upd({ followups: draft.followups.map((f, idx) => idx === i ? { ...f, ...p } : f) });

  const handleSave = async () => {
    if (!draft.template_aniversario_id && !draft.template_previsao_id) {
      toast({ title: "Selecione ao menos uma variação de disparo inicial", variant: "destructive" });
      return;
    }
    if (draft.followups.some(f => !f.template_id)) { toast({ title: "Selecione template em todos os follow-ups", variant: "destructive" }); return; }
    setSaving(true);
    try { await save(draft); toast({ title: "Cadência salva" }); await reload(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const custoInicialMax = Math.max(
    custoOf(templates, draft.template_aniversario_id),
    custoOf(templates, draft.template_previsao_id),
  );
  const total = custoInicialMax + draft.followups.reduce((s, f) => s + custoOf(templates, f.template_id), 0);

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates de Disparo Inicial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Aniversário de Compra</Label>
            <p className="text-xs text-muted-foreground mb-2">Disparado quando completa 1 ano da compra do veículo pelo cliente.</p>
            <TemplateSelectApproved
              templates={templates}
              value={draft.template_aniversario_id}
              onChange={(id) => upd({ template_aniversario_id: id })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Previsão de Oportunidade (Tempo + KM)</Label>
            <p className="text-xs text-muted-foreground mb-2">Disparado conforme a previsão calculada por tempo de uso e estimativa de quilometragem.</p>
            <TemplateSelectApproved
              templates={templates}
              value={draft.template_previsao_id}
              onChange={(id) => upd({ template_previsao_id: id })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cadência — Cliente NÃO respondeu</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {draft.followups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum follow-up configurado.</p>}
          {draft.followups.map((f, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Follow-up #{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => rmF(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid sm:grid-cols-[120px_1fr] gap-2 items-end">
                <div>
                  <Label className="text-xs">Intervalo (h)</Label>
                  <Input type="number" min={1} max={168} value={f.intervalo_horas}
                    onChange={(e) => updF(i, { intervalo_horas: Math.max(1, Math.min(168, parseInt(e.target.value) || 1)) })} />
                </div>
                <div>
                  <Label className="text-xs">Template</Label>
                  <TemplateSelectApproved templates={templates} value={f.template_id} onChange={(id) => updF(i, { template_id: id })} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addF}><Plus className="h-4 w-4 mr-1" /> Adicionar Follow-up</Button>
          {draft.followups.length > 5 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Muitos follow-ups podem gerar custos elevados.
            </p>
          )}
          <p className="text-sm">Custo estimado por lead: <strong>≈ ${total.toFixed(4)} USD</strong></p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A cadência conversacional (após o cliente responder) agora é configurada na aba <strong>Cadência Conversacional</strong>, e vale tanto para Entregas quanto para Agendamentos.
      </p>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar Cadência</Button>
      </div>
    </div>
  );
}
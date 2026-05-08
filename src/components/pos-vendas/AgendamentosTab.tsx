import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { TemplateSelectApproved } from "./TemplateSelectApproved";
import { CUSTO_POR_CATEGORIA } from "@/constants/pos-vendas-gatilhos";
import { usePatyAgentes, usePatyTemplates, usePatyCadenciaTemplates, type PatyCadenciaGatilho, type PatyCadenciaTemplates } from "@/hooks/pos-vendas/usePosVendasData";
import type { PatyTemplate } from "@/types/pos-vendas";

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
  const effectiveAgente = agentes.find(a => a.id === effectiveId) ?? null;
  const telefone = effectiveAgente?.telefone ?? null;
  const { templates } = usePatyTemplates(effectiveId, true);
  const { templates: aniversarioTemplates } = usePatyTemplates(effectiveId, true);
  void aniversarioTemplates;
  const { templates: tplsAll } = usePatyTemplates(effectiveId, true);
  void tplsAll;
  const { templates: _t } = usePatyTemplates(effectiveId, true);
  void _t;

  const { templates: templatesPri, loading, reload, upsert } = usePatyCadenciaTemplates(telefone);

  // mapas pri <-> local id
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

  // draft local mapeado para t.id (para o selector)
  const [draft, setDraft] = useState<Record<PatyCadenciaGatilho, string | null>>({
    aniversario: null, previsao: null, att_km: null,
  });
  const [saving, setSaving] = useState<PatyCadenciaGatilho | null>(null);

  useEffect(() => {
    setDraft({
      aniversario: templatesPri.aniversario ? (idByPri.get(templatesPri.aniversario) ?? null) : null,
      previsao: templatesPri.previsao ? (idByPri.get(templatesPri.previsao) ?? null) : null,
      att_km: templatesPri.att_km ? (idByPri.get(templatesPri.att_km) ?? null) : null,
    });
  }, [templatesPri, idByPri]);

  if (!effectiveId) {
    return <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />;
  }

  const handleSave = async (gatilho: PatyCadenciaGatilho) => {
    const localId = draft[gatilho];
    if (!localId) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }
    const priId = priById.get(localId);
    if (!priId) {
      toast({ title: "Template sem ID PRI", description: "Sincronize os templates antes de configurar.", variant: "destructive" });
      return;
    }
    setSaving(gatilho);
    try {
      await upsert(gatilho, priId);
      toast({ title: `Gatilho ${gatilho} atualizado` });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const renderRow = (gatilho: PatyCadenciaGatilho, label: string, descricao: string) => {
    const localId = draft[gatilho];
    const custo = custoOf(templates, localId);
    return (
      <div className="space-y-2 border rounded-md p-3">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
        <TemplateSelectApproved
          templates={templates}
          value={localId}
          onChange={(id) => setDraft(d => ({ ...d, [gatilho]: id }))}
          disabled={!telefone || loading}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{custo > 0 ? `≈ $${custo.toFixed(4)} USD/disparo` : ""}</span>
          <Button size="sm" onClick={() => handleSave(gatilho)} disabled={saving === gatilho || !telefone}>
            <Save className="h-4 w-4 mr-1" /> {saving === gatilho ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AgenteSelector agentes={agentes} value={effectiveId} onChange={setAgenteId} loading={loadingAgentes} />

      {!telefone && (
        <p className="text-sm text-amber-600">Agente sem telefone cadastrado — não é possível carregar a configuração.</p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Templates de Disparo Inicial</CardTitle>
          <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading || !telefone}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderRow("aniversario", "Aniversário de Compra", "Disparado quando completa 1 ano da compra do veículo pelo cliente.")}
          {renderRow("previsao", "Previsão de Oportunidade (Tempo + KM)", "Disparado conforme a previsão calculada por tempo de uso e estimativa de quilometragem.")}
          {renderRow("att_km", "Atualização de KM", "Disparado para solicitar atualização da quilometragem do veículo.")}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A cadência conversacional (após o cliente responder) é configurada na aba <strong>Cadência Conversacional</strong> e vale tanto para Entregas quanto para Agendamentos.
      </p>
    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, RefreshCw, Trash2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgenteSelector } from "./AgenteSelector";
import { TemplateSelectApproved } from "./TemplateSelectApproved";
import { CUSTO_POR_CATEGORIA } from "@/constants/pos-vendas-gatilhos";
import {
  usePatyAgentes,
  usePatyTemplates,
  usePatyCadenciaTemplates,
  usePatyCadenciaSteps,
  montarIntervalo,
  formatarIntervalo,
  type PatyCadenciaGatilho,
  type PatyCadenciaStep,
  type IntervaloUnidade,
} from "@/hooks/pos-vendas/usePosVendasData";
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
  const { templates: templatesPri, loading, reload, upsert } = usePatyCadenciaTemplates(telefone);
  const { steps, loading: loadingSteps, reload: reloadSteps, create: createStep, remove: removeStep } = usePatyCadenciaSteps(telefone);

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

  const handleReloadAll = async () => {
    await Promise.all([reload(), reloadSteps()]);
  };

  const renderRow = (gatilho: PatyCadenciaGatilho, label: string, descricao: string) => {
    const localId = draft[gatilho];
    const custo = custoOf(templates, localId);
    const initialSaved = !!templatesPri[gatilho];
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

        <StepsSection
          gatilho={gatilho}
          steps={steps[gatilho]}
          templates={templates}
          idByPri={idByPri}
          priById={priById}
          disabled={!telefone || !initialSaved}
          disabledReason={!telefone ? "Agente sem telefone." : !initialSaved ? "Salve o disparo inicial antes de configurar steps." : ""}
          onCreate={createStep}
          onRemove={removeStep}
        />
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
          <Button variant="outline" size="sm" onClick={handleReloadAll} disabled={loading || loadingSteps || !telefone}>
            <RefreshCw className={`h-4 w-4 mr-1 ${(loading || loadingSteps) ? "animate-spin" : ""}`} /> Atualizar
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

// ============================================================
// Sub-componente: Lista + formulário de steps de um gatilho
// ============================================================
interface StepsSectionProps {
  gatilho: PatyCadenciaGatilho;
  steps: PatyCadenciaStep[];
  templates: PatyTemplate[];
  idByPri: Map<string, string>;
  priById: Map<string, string>;
  disabled: boolean;
  disabledReason: string;
  onCreate: (gatilho: PatyCadenciaGatilho, intervalo: string, templateIdPri: string) => Promise<void>;
  onRemove: (gatilho: PatyCadenciaGatilho, stepId: number) => Promise<void>;
}

function StepsSection({ gatilho, steps, templates, idByPri, priById, disabled, disabledReason, onCreate, onRemove }: StepsSectionProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unidade, setUnidade] = useState<IntervaloUnidade>("horas");
  const [templateLocal, setTemplateLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const resetForm = () => {
    setQuantidade(1);
    setUnidade("horas");
    setTemplateLocal(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!templateLocal) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }
    if (!quantidade || quantidade < 1) {
      toast({ title: "Quantidade inválida", variant: "destructive" });
      return;
    }
    const priId = priById.get(templateLocal);
    if (!priId) {
      toast({ title: "Template sem ID PRI", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onCreate(gatilho, montarIntervalo(quantidade, unidade), priId);
      toast({ title: "Step adicionado" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao adicionar step", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (step: PatyCadenciaStep) => {
    setRemovingId(step.id);
    try {
      await onRemove(gatilho, step.id);
      toast({ title: "Step removido" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Cadência para quem não respondeu
        </Label>
      </div>

      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum step configurado.</p>
      ) : (
        <ul className="space-y-2">
          {steps.map(step => {
            const localId = idByPri.get(step.template_id) ?? null;
            const tpl = templates.find(t => t.id === localId);
            return (
              <li key={step.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded px-2 py-1.5">
                <span className="font-medium whitespace-nowrap">Etapa {step.etapa}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">· {formatarIntervalo(step.intervalo_texto)}</span>
                <span className="flex-1 truncate text-xs">
                  {tpl ? tpl.nome : <span className="text-muted-foreground italic">Template não encontrado (PRI {step.template_id})</span>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(step)}
                  disabled={removingId === step.id}
                  aria-label="Remover step"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <div className="mt-3 space-y-2 border rounded-md p-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Select value={unidade} onValueChange={(v) => setUnidade(v as IntervaloUnidade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutos">Minutos</SelectItem>
                  <SelectItem value="horas">Horas</SelectItem>
                  <SelectItem value="dias">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <TemplateSelectApproved
              templates={templates}
              value={templateLocal}
              onChange={setTemplateLocal}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar step"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={disabled}
            title={disabled ? disabledReason : ""}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar step
          </Button>
          {disabled && disabledReason && (
            <p className="text-xs text-muted-foreground mt-1">{disabledReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
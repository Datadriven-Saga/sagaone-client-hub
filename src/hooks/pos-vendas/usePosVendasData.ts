import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { PATY_NAME_FILTER } from "@/constants/pos-vendas-gatilhos";
import type { PatyAgente, PatyTemplate, GatilhoConfig, CadenciaConfig, FollowupConfig, LojaPosVenda, FollowUpCadenceConfig, FollowUpCadenceInterval } from "@/types/pos-vendas";

export function usePatyAgentes() {
  const { activeCompany } = useCompany();
  const [agentes, setAgentes] = useState<PatyAgente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from("agente_empresas")
        .select("agente_id")
        .eq("empresa_id", activeCompany.id);
      const ids = (links ?? []).map((l: any) => l.agente_id);
      if (ids.length === 0) {
        if (!cancelled) { setAgentes([]); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("agentes_ia")
        .select("id, nome, telefone, ativo")
        .in("id", ids)
        .ilike("nome", PATY_NAME_FILTER)
        .order("nome");
      const base = (data ?? []) as PatyAgente[];

      // Enrich with marca/uf from external webhook (same source as /administracao/agentes)
      let enriched = base;
      try {
        const { data: wh } = await supabase.functions.invoke("external-webhook-proxy", {
          body: { endpoint: "busca-dados-agentes" },
        });
        const arr = Array.isArray(wh) ? wh : [];
        const byPhone = new Map<string, { marca?: string; uf?: string }>();
        for (const w of arr) {
          if (w?.num_maia) byPhone.set(String(w.num_maia), { marca: w.marca, uf: w.uf });
        }
        enriched = base.map(a => {
          const m = a.telefone ? byPhone.get(String(a.telefone)) : undefined;
          return m ? { ...a, marca: m.marca ?? null, uf: m.uf ?? null } : a;
        });
      } catch (e) {
        console.warn("[usePatyAgentes] failed to enrich marca/uf:", e);
      }

      if (!cancelled) {
        setAgentes(enriched);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompany?.id]);

  return { agentes, loading };
}

export function usePatyTemplates(agenteId: string | null, approvedOnly = false) {
  const { activeCompany } = useCompany();
  const [templates, setTemplates] = useState<PatyTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!activeCompany?.id || !agenteId) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("whatsapp_templates")
      .select("id, nome, categoria, category_meta, status_meta, agente_id, template_id_pri")
      .eq("empresa_id", activeCompany.id)
      .eq("agente_id", agenteId)
      .eq("ativo", true);
    if (approvedOnly) q = q.eq("status_meta", "APPROVED");
    const { data } = await q.order("nome");
    setTemplates((data ?? []) as PatyTemplate[]);
    setLoading(false);
  }, [activeCompany?.id, agenteId, approvedOnly]);

  useEffect(() => { reload(); }, [reload]);

  return { templates, loading, reload };
}

export function useGatilhosConfig(agenteId: string | null) {
  const { activeCompany } = useCompany();
  const [configs, setConfigs] = useState<GatilhoConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!activeCompany?.id || !agenteId) { setConfigs([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("pos_vendas_gatilho_config")
      .select("*")
      .eq("agente_id", agenteId)
      .eq("empresa_id", activeCompany.id);
    setConfigs((data ?? []) as GatilhoConfig[]);
    setLoading(false);
  }, [activeCompany?.id, agenteId]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (slug: string, patch: Partial<GatilhoConfig>) => {
    if (!activeCompany?.id || !agenteId) return;
    const existing = configs.find(c => c.gatilho_slug === slug);
    const row = {
      agente_id: agenteId,
      empresa_id: activeCompany.id,
      gatilho_slug: slug,
      template_id: existing?.template_id ?? null,
      ativo: existing?.ativo ?? false,
      ...patch,
    };
    const { error } = await supabase
      .from("pos_vendas_gatilho_config")
      .upsert(row, { onConflict: "agente_id,empresa_id,gatilho_slug" });
    if (error) throw error;
    await reload();
  }, [activeCompany?.id, agenteId, configs, reload]);

  return { configs, loading, reload, upsert };
}

export function useCadenciaConfig(agenteId: string | null) {
  const { activeCompany } = useCompany();
  const [cadencia, setCadencia] = useState<CadenciaConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!activeCompany?.id || !agenteId) { setCadencia(null); return; }
    setLoading(true);
    const { data: cad } = await supabase
      .from("pos_vendas_cadencia_config")
      .select("*")
      .eq("agente_id", agenteId)
      .eq("empresa_id", activeCompany.id)
      .maybeSingle();
    if (!cad) {
      setCadencia({
        agente_id: agenteId,
        empresa_id: activeCompany.id,
        template_inicial_id: null,
        template_aniversario_id: null,
        template_previsao_id: null,
        ativo: true,
        followups: [],
      });
      setLoading(false);
      return;
    }
    const { data: fups } = await supabase
      .from("pos_vendas_followup")
      .select("*")
      .eq("cadencia_id", cad.id)
      .order("ordem");
    setCadencia({ ...(cad as any), followups: (fups ?? []) as FollowupConfig[] });
    setLoading(false);
  }, [activeCompany?.id, agenteId]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (next: CadenciaConfig) => {
    if (!activeCompany?.id || !agenteId) return;
    const { data: up, error } = await supabase
      .from("pos_vendas_cadencia_config")
      .upsert({
        id: next.id,
        agente_id: agenteId,
        empresa_id: activeCompany.id,
        template_inicial_id: next.template_inicial_id,
        template_aniversario_id: next.template_aniversario_id,
        template_previsao_id: next.template_previsao_id,
        ativo: next.ativo,
      }, { onConflict: "agente_id,empresa_id" })
      .select("id")
      .single();
    if (error) throw error;
    const cadId = up.id as string;
    await supabase.from("pos_vendas_followup").delete().eq("cadencia_id", cadId);
    if (next.followups.length > 0) {
      const { error: e2 } = await supabase.from("pos_vendas_followup").insert(
        next.followups.map((f, i) => ({
          cadencia_id: cadId,
          ordem: i + 1,
          template_id: f.template_id,
          intervalo_horas: f.intervalo_horas,
          ativo: f.ativo,
        }))
      );
      if (e2) throw e2;
    }
    await reload();
  }, [activeCompany?.id, agenteId, reload]);

  return { cadencia, setCadencia, loading, save, reload };
}

export function useLojasPosVenda(agenteId: string | null) {
  const { activeCompany } = useCompany();
  const [lojas, setLojas] = useState<LojaPosVenda[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!activeCompany?.id || !agenteId) { setLojas([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("pos_vendas_lojas")
      .select("*")
      .eq("agente_id", agenteId)
      .eq("empresa_id", activeCompany.id)
      .order("marca")
      .order("uf");
    setLojas((data ?? []) as LojaPosVenda[]);
    setLoading(false);
  }, [activeCompany?.id, agenteId]);

  useEffect(() => { reload(); }, [reload]);

  return { lojas, loading, reload };
}
// ====================================================================
// Cadência Conversacional (compartilhada Entregas + Agendamentos)
// Chaveada por tel_agent (telefone do agente). Fallback row 'DEFAULT'.
// ====================================================================
function intervalToHours(v: any): number {
  // Postgres interval pode vir como string "HH:MM:SS" ou objeto { hours, minutes, ... }
  if (v == null) return 0;
  if (typeof v === "object") {
    const h = Number(v.hours ?? 0);
    const d = Number(v.days ?? 0);
    const m = Number(v.minutes ?? 0);
    return d * 24 + h + m / 60;
  }
  if (typeof v === "string") {
    const parts = v.split(":");
    if (parts.length >= 2) return Number(parts[0]) + Number(parts[1]) / 60;
    const n = Number(v);
    if (!isNaN(n)) return n;
  }
  if (typeof v === "number") return v;
  return 0;
}

export function useFollowUpCadence(telAgent: string | null) {
  const [config, setConfig] = useState<{ tel_agent: string; max_attempts: number; active: boolean } | null>(null);
  const [intervals, setIntervals] = useState<{ from_attempt: number; wait_hours: number }[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!telAgent) { setConfig(null); setIntervals([]); return; }
    setLoading(true);
    // Tenta buscar do agente; se não houver, cai no DEFAULT
    let { data: cfg } = await supabase
      .from("follow_up_cadence_config")
      .select("*")
      .eq("tel_agent", telAgent)
      .maybeSingle();
    let usingDefault = false;
    if (!cfg) {
      const { data: def } = await supabase
        .from("follow_up_cadence_config")
        .select("*")
        .eq("tel_agent", "DEFAULT")
        .maybeSingle();
      cfg = def;
      usingDefault = true;
    }
    if (!cfg) { setConfig(null); setIntervals([]); setLoading(false); return; }
    const { data: ivs } = await supabase
      .from("follow_up_cadence_intervals")
      .select("from_attempt, wait_interval")
      .eq("tel_agent", cfg.tel_agent)
      .order("from_attempt");
    setConfig({ tel_agent: cfg.tel_agent, max_attempts: cfg.max_attempts, active: cfg.active });
    setIntervals((ivs ?? []).map((r: any) => ({ from_attempt: r.from_attempt, wait_hours: intervalToHours(r.wait_interval) })));
    setIsDefault(usingDefault);
    setLoading(false);
  }, [telAgent]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (next: { max_attempts: number; active: boolean; intervals: { from_attempt: number; wait_hours: number }[] }) => {
    if (!telAgent) return;
    const { error: e1 } = await supabase
      .from("follow_up_cadence_config")
      .upsert({ tel_agent: telAgent, max_attempts: next.max_attempts, active: next.active }, { onConflict: "tel_agent" });
    if (e1) throw e1;
    await supabase.from("follow_up_cadence_intervals").delete().eq("tel_agent", telAgent);
    if (next.intervals.length > 0) {
      const { error: e2 } = await supabase.from("follow_up_cadence_intervals").insert(
        next.intervals.map(i => ({ tel_agent: telAgent, from_attempt: i.from_attempt, wait_interval: `${i.wait_hours} hours` }))
      );
      if (e2) throw e2;
    }
    await reload();
  }, [telAgent, reload]);

  return { config, intervals, isDefault, loading, save, reload };
}

// ====================================================================
// Paty Cadência - Templates Iniciais (via webhook externo)
// Gatilhos: 'aniversario' | 'previsao' | 'att_km'
// Comportamento espelhado de /administracao/agentes: depende do retorno
// do webhook (sem persistência local).
// ====================================================================
export type PatyCadenciaGatilho = "aniversario" | "previsao" | "att_km";

export interface PatyCadenciaTemplates {
  aniversario: string | null;
  previsao: string | null;
  att_km: string | null;
}

function pickTemplateId(row: any, gatilho: PatyCadenciaGatilho): string | null {
  if (!row) return null;
  // Aceita várias formas de retorno do n8n
  const direct =
    row[`template_${gatilho}_id`] ??
    row[`template_${gatilho}`] ??
    row[gatilho] ??
    null;
  if (direct) return String(direct);
  const tipo = row.gatilho ?? row.gatilho_tipo ?? row.tipo ?? null;
  if (tipo === gatilho) {
    return row.template_id_pri ?? row.template_id ?? row.id_pri ?? null;
  }
  return null;
}

export function usePatyCadenciaTemplates(agenteTelefone: string | null) {
  const [templates, setTemplates] = useState<PatyCadenciaTemplates>({
    aniversario: null,
    previsao: null,
    att_km: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!agenteTelefone) {
      setTemplates({ aniversario: null, previsao: null, att_km: null });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-cadencia-config-template", agente_telefone: agenteTelefone },
      });
      if (err) throw new Error(err.message);
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      // Pode vir como [{aniversario:..., previsao:..., att_km:...}] OU [{gatilho, template_id_pri}, ...]
      const next: PatyCadenciaTemplates = { aniversario: null, previsao: null, att_km: null };
      for (const row of arr) {
        for (const g of ["aniversario", "previsao", "att_km"] as PatyCadenciaGatilho[]) {
          const v = pickTemplateId(row, g);
          if (v) next[g] = v;
        }
      }
      setTemplates(next);
    } catch (e: any) {
      console.error("[usePatyCadenciaTemplates] reload error:", e);
      setError(e.message ?? "Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  }, [agenteTelefone]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (gatilho: PatyCadenciaGatilho, templateIdPri: string | null) => {
    if (!agenteTelefone) throw new Error("Telefone do agente não disponível");
    const { error: err } = await supabase.functions.invoke("external-webhook-proxy", {
      body: {
        endpoint: "upsert-paty-cadencia-config-template",
        agente_telefone: agenteTelefone,
        gatilho,
        template_id_pri: templateIdPri,
      },
    });
    if (err) throw new Error(err.message);
  }, [agenteTelefone]);

  return { templates, setTemplates, loading, error, reload, upsert };
}

// ====================================================================
// Paty Cadência - Steps de Follow-up (via webhook externo)
// ====================================================================
export interface PatyCadenciaStep {
  id: number;
  config_id?: number;
  etapa: number;
  intervalo_texto: string;
  intervalo_segundos?: number;
  template_id: string; // ID PRI
  ativo: boolean;
  gatilho_tipo: PatyCadenciaGatilho;
  agente_telefone?: string;
}

export type PatyStepsByGatilho = Record<PatyCadenciaGatilho, PatyCadenciaStep[]>;

export type IntervaloUnidade = "minutos" | "horas" | "dias";

export function montarIntervalo(quantidade: number, unidade: IntervaloUnidade): string {
  const mapa: Record<IntervaloUnidade, string> = { minutos: "minutes", horas: "hours", dias: "days" };
  return `${quantidade} ${mapa[unidade]}`;
}

export function formatarIntervalo(intervaloTexto: string | null | undefined): string {
  if (!intervaloTexto) return "";
  const t = String(intervaloTexto).trim();
  const diasHorasMatch = t.match(/^(\d+)\s+days?\s+(\d+):(\d+):(\d+)$/);
  if (diasHorasMatch) {
    return `${diasHorasMatch[1]}d ${parseInt(diasHorasMatch[2])}h`;
  }
  const diasOnly = t.match(/^(\d+)\s+days?$/);
  if (diasOnly) {
    const d = diasOnly[1];
    return `${d} dia${d !== "1" ? "s" : ""}`;
  }
  const horasMatch = t.match(/^(\d+):(\d+):(\d+)$/);
  if (horasMatch) {
    const h = parseInt(horasMatch[1]);
    const m = parseInt(horasMatch[2]);
    if (h > 0 && m === 0) return `${h} hora${h !== 1 ? "s" : ""}`;
    if (h === 0 && m > 0) return `${m} minuto${m !== 1 ? "s" : ""}`;
    return `${h}h ${m}min`;
  }
  return t;
}

const GATILHOS: PatyCadenciaGatilho[] = ["aniversario", "previsao", "att_km"];

export function usePatyCadenciaSteps(agenteTelefone: string | null) {
  const [steps, setSteps] = useState<PatyStepsByGatilho>({ aniversario: [], previsao: [], att_km: [] });
  const [loading, setLoading] = useState(false);

  const reloadGatilho = useCallback(async (gatilho: PatyCadenciaGatilho) => {
    if (!agenteTelefone) return;
    const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "busca-paty-cadencia-steps", agente_telefone: agenteTelefone, gatilho_tipo: gatilho },
    });
    if (error) {
      console.error(`[usePatyCadenciaSteps] reload ${gatilho}:`, error);
      return;
    }
    const arr = Array.isArray(data) ? data : [];
    const list: PatyCadenciaStep[] = arr
      .map((r: any) => ({
        id: Number(r.id),
        config_id: r.config_id != null ? Number(r.config_id) : undefined,
        etapa: Number(r.etapa ?? 0),
        intervalo_texto: String(r.intervalo_texto ?? r.intervalo ?? ""),
        intervalo_segundos: r.intervalo_segundos != null ? Number(r.intervalo_segundos) : undefined,
        template_id: String(r.template_id ?? r.template_id_pri ?? ""),
        ativo: r.ativo !== false,
        gatilho_tipo: gatilho,
        agente_telefone: r.agente_telefone,
      }))
      .sort((a, b) => a.etapa - b.etapa);
    setSteps(prev => ({ ...prev, [gatilho]: list }));
  }, [agenteTelefone]);

  const reload = useCallback(async () => {
    if (!agenteTelefone) {
      setSteps({ aniversario: [], previsao: [], att_km: [] });
      return;
    }
    setLoading(true);
    try {
      await Promise.all(GATILHOS.map(g => reloadGatilho(g)));
    } finally {
      setLoading(false);
    }
  }, [agenteTelefone, reloadGatilho]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (gatilho: PatyCadenciaGatilho, intervalo: string, templateIdPri: string) => {
    if (!agenteTelefone) throw new Error("Telefone do agente não disponível");
    const proximaEtapa = steps[gatilho].length > 0
      ? Math.max(...steps[gatilho].map(s => s.etapa)) + 1
      : 1;
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: {
        endpoint: "upsert-paty-cadencia-steps",
        agente_telefone: agenteTelefone,
        gatilho_tipo: gatilho,
        etapa: proximaEtapa,
        intervalo,
        template_id_pri: templateIdPri,
        ativo: true,
      },
    });
    if (error) throw new Error(error.message);
    await reloadGatilho(gatilho);
  }, [agenteTelefone, steps, reloadGatilho]);

  const remove = useCallback(async (gatilho: PatyCadenciaGatilho, stepId: number) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "delete-paty-cadencia-step", step_id: stepId },
    });
    if (error) throw new Error(error.message);
    await reloadGatilho(gatilho);
  }, [reloadGatilho]);

  return { steps, loading, reload, reloadGatilho, create, remove };
}

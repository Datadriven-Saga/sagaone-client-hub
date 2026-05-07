import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { PATY_NAME_FILTER } from "@/constants/pos-vendas-gatilhos";
import type { PatyAgente, PatyTemplate, GatilhoConfig, CadenciaConfig, FollowupConfig, LojaPosVenda } from "@/types/pos-vendas";

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
      const agentesBase = (data ?? []) as PatyAgente[];
      const nomes = Array.from(new Set(agentesBase.map(a => a.nome).filter(Boolean)));
      const byNome: Record<string, { marcas: Set<string>; ufs: Set<string> }> = {};
      if (nomes.length > 0) {
        const { data: ctrl } = await supabase
          .from("controle_agentes")
          .select("nome_agente, marca, uf, ativo")
          .in("nome_agente", nomes)
          .eq("ativo", true);
        for (const r of (ctrl ?? []) as any[]) {
          const key = (r.nome_agente || "").toLowerCase();
          if (!byNome[key]) byNome[key] = { marcas: new Set(), ufs: new Set() };
          if (r.marca) byNome[key].marcas.add(r.marca);
          if (r.uf) byNome[key].ufs.add(r.uf);
        }
      }
      const enriched = agentesBase.map(a => {
        const k = (a.nome || "").toLowerCase();
        return {
          ...a,
          marcas: Array.from(byNome[k]?.marcas ?? []).sort(),
          ufs: Array.from(byNome[k]?.ufs ?? []).sort(),
        };
      });
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
      .select("id, nome, categoria, category_meta, status_meta, agente_id")
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
        max_tentativas: 3,
        intervalo_tentativas_horas: 24,
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
        max_tentativas: next.max_tentativas,
        intervalo_tentativas_horas: next.intervalo_tentativas_horas,
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
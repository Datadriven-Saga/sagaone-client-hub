import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EntregaTemplateRow {
  id: number;
  agente_telefone: string;
  slug: string;
  gatilho: string;
  sequencia: number;
  template_id: string; // ID PRI
  ativo: boolean;
}

export const ENTREGA_SLUGS_FIXOS = [
  "novo-lead-criacao",
  "confirma-agendamento",
  "entrega-confirmada",
  "aviso-entrega-24h",
  "MESSAGE_SENT_BEFORE_1H",
  "MESSAGE_SENT_AFTER_1H",
  "MESSAGE_SENT_AFTER_1D",
] as const;

const ENTREGA_WEBHOOKS = {
  buscaTemplates: "paty.entrega.busca_template",
  upsertTemplate: "paty.entrega.upsert_template",
  desativaTemplate: "paty.entrega.desativa_template",
  removeTemplate: "paty.entrega.remove_template",
} as const;

export type EntregaRowsBySlug = Record<string, EntregaTemplateRow[]>;

export function usePatyEntregasTemplates(agenteTelefone: string | null) {
  const [rowsBySlug, setRowsBySlug] = useState<EntregaRowsBySlug>({});
  const [loading, setLoading] = useState(false);

  const buildInitial = useCallback((agente: string, raw: any[]): EntregaRowsBySlug => {
    const grouped: EntregaRowsBySlug = {};
    for (const slug of ENTREGA_SLUGS_FIXOS) grouped[slug] = [];
    for (const r of raw) {
      const slug = String(r.gatilho ?? r.slug ?? "");
      if (!slug) continue;
      if (!grouped[slug]) grouped[slug] = [];
      grouped[slug].push({
        id: Number(r.id ?? -1),
        agente_telefone: String(r.agente_telefone ?? agente),
        slug,
        gatilho: slug,
        sequencia: Number(r.sequencia ?? 0),
        template_id: String(r.template_id ?? ""),
        ativo: r.ativo !== false,
      });
    }
    for (const slug of Object.keys(grouped)) {
      grouped[slug].sort((a, b) => a.sequencia - b.sequencia);
      if (grouped[slug].length === 0) {
        grouped[slug].push({
          id: -1,
          agente_telefone: agente,
          slug,
          gatilho: slug,
          sequencia: 0,
          template_id: "",
          ativo: false,
        });
      }
    }
    return grouped;
  }, []);

  const reload = useCallback(async () => {
    if (!agenteTelefone) { setRowsBySlug({}); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { webhook_slug: ENTREGA_WEBHOOKS.buscaTemplates, agente_telefone: agenteTelefone },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : [];
      setRowsBySlug(buildInitial(agenteTelefone, arr));
    } catch (e) {
      console.error("[usePatyEntregasTemplates] reload error:", e);
      setRowsBySlug(buildInitial(agenteTelefone, []));
    } finally {
      setLoading(false);
    }
  }, [agenteTelefone, buildInitial]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (payload: {
    slug: string; sequencia: number; template_id: string; ativo: boolean;
  }) => {
    if (!agenteTelefone) throw new Error("Telefone do agente não disponível");
    // Otimismo: atualiza local antes da chamada
    setRowsBySlug(prev => {
      const list = prev[payload.slug] ? [...prev[payload.slug]] : [];
      const idx = list.findIndex(r => r.sequencia === payload.sequencia);
      const next: EntregaTemplateRow = {
        id: idx >= 0 ? list[idx].id : -1,
        agente_telefone: agenteTelefone,
        slug: payload.slug,
        gatilho: payload.slug,
        sequencia: payload.sequencia,
        template_id: payload.template_id,
        ativo: payload.ativo,
      };
      if (idx >= 0) list[idx] = { ...list[idx], ...next };
      else list.push(next);
      list.sort((a, b) => a.sequencia - b.sequencia);
      return { ...prev, [payload.slug]: list };
    });
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: {
        webhook_slug: ENTREGA_WEBHOOKS.upsertTemplate,
        agente_telefone: agenteTelefone,
        gatilho: payload.slug,
        slug: payload.slug,
        sequencia: payload.sequencia,
        template_id: payload.template_id,
        ativo: payload.ativo,
      },
    });
    if (error) throw new Error(error.message);
    reload().catch(() => {});
  }, [agenteTelefone, reload]);

  const desativar = useCallback(async (id: number) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { webhook_slug: ENTREGA_WEBHOOKS.desativaTemplate, id },
    });
    if (error) throw new Error(error.message);
    reload().catch(() => {});
  }, [reload]);

  const remover = useCallback(async (id: number) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { webhook_slug: ENTREGA_WEBHOOKS.removeTemplate, id },
    });
    if (error) throw new Error(error.message);
    reload().catch(() => {});
  }, [reload]);

  // Manipulações puramente locais (rascunhos visuais)
  const addDraftSequencia = useCallback((slug: string) => {
    setRowsBySlug(prev => {
      const list = prev[slug] ? [...prev[slug]] : [];
      const nextSeq = list.length === 0 ? 0 : Math.max(...list.map(r => r.sequencia)) + 1;
      list.push({
        id: -1,
        agente_telefone: agenteTelefone ?? "",
        slug,
        gatilho: slug,
        sequencia: nextSeq,
        template_id: "",
        ativo: false,
      });
      return { ...prev, [slug]: list };
    });
  }, [agenteTelefone]);

  const removeLocalRow = useCallback((slug: string, sequencia: number) => {
    setRowsBySlug(prev => {
      const list = prev[slug] ? prev[slug].filter(r => r.sequencia !== sequencia) : [];
      // Garante que sequencia 0 sempre exista para manter UI consistente
      if (!list.some(r => r.sequencia === 0)) {
        list.unshift({
          id: -1,
          agente_telefone: agenteTelefone ?? "",
          slug,
          gatilho: slug,
          sequencia: 0,
          template_id: "",
          ativo: false,
        });
      }
      list.sort((a, b) => a.sequencia - b.sequencia);
      return { ...prev, [slug]: list };
    });
  }, [agenteTelefone]);

  return { rowsBySlug, loading, reload, upsert, desativar, remover, addDraftSequencia, removeLocalRow };
}
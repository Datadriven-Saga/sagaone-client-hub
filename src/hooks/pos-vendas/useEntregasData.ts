import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EntregaTemplateRow {
  id: number;
  agente_telefone: string;
  slug: string;
  template_id: string; // ID PRI
  ativo: boolean;
}

export function usePatyEntregasTemplates(agenteTelefone: string | null) {
  const [rows, setRows] = useState<EntregaTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!agenteTelefone) { setRows([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-entrega-template", agente_telefone: agenteTelefone },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : [];
      setRows(arr.map((r: any) => ({
        id: Number(r.id),
        agente_telefone: String(r.agente_telefone ?? ""),
        slug: String(r.slug ?? ""),
        template_id: String(r.template_id ?? ""),
        ativo: r.ativo !== false,
      })));
    } catch (e) {
      console.error("[usePatyEntregasTemplates] reload error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [agenteTelefone]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (payload: {
    slug: string; template_id: string; ativo: boolean;
  }) => {
    if (!agenteTelefone) throw new Error("Telefone do agente não disponível");
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "upsert-paty-entrega-template", agente_telefone: agenteTelefone, ...payload },
    });
    if (error) throw new Error(error.message);
    await reload();
  }, [agenteTelefone, reload]);

  const desativar = useCallback(async (id: number) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "desativa-paty-entrega-template", id },
    });
    if (error) throw new Error(error.message);
    await reload();
  }, [reload]);

  return { rows, loading, reload, upsert, desativar };
}
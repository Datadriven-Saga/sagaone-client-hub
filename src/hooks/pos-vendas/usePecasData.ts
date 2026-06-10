import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PecasTemplateRow {
  id: number;
  agente_telefone: string;
  status: string;
  tipo_requisicao: string;
  template_id: string; // ID PRI
  ativo: boolean;
}

export function usePatyPecasTemplates(agenteTelefone: string | null) {
  const [rows, setRows] = useState<PecasTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!agenteTelefone) { setRows([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-pecas-template", agente_telefone: agenteTelefone },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : [];
      setRows(arr.map((r: any) => ({
        id: Number(r.id),
        agente_telefone: String(r.agente_telefone ?? ""),
        status: String(r.status ?? ""),
        tipo_requisicao: String(r.tipo_requisicao ?? ""),
        template_id: String(r.template_id ?? ""),
        ativo: r.ativo !== false,
      })));
    } catch (e) {
      console.error("[usePatyPecasTemplates] reload error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [agenteTelefone]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (payload: {
    status: string; tipo_requisicao: string; template_id: string; ativo: boolean;
  }) => {
    if (!agenteTelefone) throw new Error("Telefone do agente não disponível");
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "upsert-paty-pecas-template", agente_telefone: agenteTelefone, ...payload },
    });
    if (error) throw new Error(error.message);
    await reload();
  }, [agenteTelefone, reload]);

  const desativar = useCallback(async (id: number) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: { endpoint: "desativa-paty-pecas-template", id },
    });
    if (error) throw new Error(error.message);
    await reload();
  }, [reload]);

  return { rows, loading, reload, upsert, desativar };
}

export interface PecasLoja {
  id?: number;
  cnpj: string;
  nome_loja?: string | null;
  dias_adicionais?: number | null;
  agente_telefone?: string | null;
  horario_funcionamento?: string | null;
  endereco_loja?: string | null;
  ativo: boolean;
}

export function usePatyPecasLojas() {
  const [lojas, setLojas] = useState<PecasLoja[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (opts?: { throwOnError?: boolean }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-pecas-prazo" },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : [];
      setLojas(arr.map((r: any) => ({
        id: r.id != null ? Number(r.id) : undefined,
        cnpj: String(r.cnpj ?? ""),
        nome_loja: r.nome_loja ?? null,
        dias_adicionais: r.dias_adicionais != null ? Number(r.dias_adicionais) : 0,
        agente_telefone: r.agente_telefone ?? null,
        horario_funcionamento: r.horario_funcionamento ?? null,
        endereco_loja: r.endereco_loja ?? null,
        ativo: r.ativo !== false,
      })));
    } catch (e) {
      console.error("[usePatyPecasLojas] reload error:", e);
      setLojas([]);
      if (opts?.throwOnError) throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const upsert = useCallback(async (loja: PecasLoja) => {
    const { error } = await supabase.functions.invoke("external-webhook-proxy", {
      body: {
        endpoint: "upsert-paty-pecas-prazo",
        cnpj: loja.cnpj,
        nome_loja: loja.nome_loja ?? null,
        dias_adicionais: loja.dias_adicionais ?? 0,
        agente_telefone: loja.agente_telefone ?? null,
        horario_funcionamento: loja.horario_funcionamento ?? null,
        endereco_loja: loja.endereco_loja ?? null,
        ativo: loja.ativo,
      },
    });
    if (error) throw new Error(error.message);
    await reload();
  }, [reload]);

  return { lojas, loading, reload, upsert };
}
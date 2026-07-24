import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";

export type StatusLead =
  | "Novo"
  | "Atribuído"
  | "Em Espera"
  | "Convidado"
  | "Confirmado"
  | "Check-in"
  | "Venda"
  | "Descartado"
  | "Opt Out";

export const COLUNAS: { status: StatusLead; titulo: string }[] = [
  { status: "Novo", titulo: "Novos" },
  { status: "Atribuído", titulo: "Atribuídos" },
  { status: "Em Espera", titulo: "Em Espera" },
  { status: "Convidado", titulo: "Convidados" },
  { status: "Confirmado", titulo: "Confirmados" },
  { status: "Check-in", titulo: "Check-ins" },
  { status: "Venda", titulo: "Vendas" },
  { status: "Descartado", titulo: "Descartados" },
  { status: "Opt Out", titulo: "Opt Out" },
];

export interface LeadCard {
  id: string;
  nome: string;
  telefone: string;
  responsavel_email?: string | null;
  status: StatusLead;
}

export interface ColunaData {
  status: StatusLead;
  titulo: string;
  count: number;
  items: LeadCard[];
}

export interface EventoOption {
  id: string;
  nome: string;
}

/** Lista de eventos disponíveis para o filtro (empresa ativa). */
export function useEventosDisponiveis() {
  const { activeCompany } = useCompany();
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompany?.id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("prospeccoes")
        .select("id, nome_evento")
        .eq("empresa_id", activeCompany.id)
        .order("data_inicio", { ascending: false })
        .limit(200);
      if (cancel) return;
      if (error) {
        console.error("kanban-basico: eventos", error);
        setEventos([]);
      } else {
        setEventos(
          (data ?? []).map((p: any) => ({ id: p.id, nome: p.nome_evento ?? "(sem nome)" })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [activeCompany?.id]);

  return { eventos, loading };
}

/**
 * Kanban básico: lê status por evento via get_kanban_columns.
 * Exige ao menos 1 prospeccao_id (evita timeout 57014).
 */
export function useKanbanBasico(prospeccaoIds: string[]) {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const [colunas, setColunas] = useState<ColunaData[]>(
    COLUNAS.map((c) => ({ ...c, count: 0, items: [] })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setError(null);
    if (!activeCompany?.id) return;
    if (!prospeccaoIds || prospeccaoIds.length === 0) {
      setColunas(COLUNAS.map((c) => ({ ...c, count: 0, items: [] })));
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc("get_kanban_columns" as any, {
        p_empresa_id: activeCompany.id,
        p_prospeccao_ids: prospeccaoIds,
        p_per_column: 50,
        p_responsavel: null,
        p_search: null,
        p_date_start: null,
        p_date_end: null,
      });
      if (err) throw err;
      const raw = (data ?? {}) as Record<string, { count: number; items: any[] }>;
      setColunas(
        COLUNAS.map(({ status, titulo }) => {
          const bucket = raw[status] ?? { count: 0, items: [] };
          return {
            status,
            titulo,
            count: bucket.count ?? 0,
            items: (bucket.items ?? []).map((r: any) => ({
              id: r.id,
              nome: r.nome ?? "(sem nome)",
              telefone: r.telefone ?? "",
              responsavel_email: r.responsavel_email ?? null,
              status: status,
            })),
          };
        }),
      );
    } catch (e: any) {
      console.error("kanban-basico: fetch", e);
      setError(e?.message ?? "Falha ao carregar Kanban");
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, prospeccaoIds.join(",")]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /**
   * Move um lead para outro status. Grava log em logs_movimentacao_contatos
   * (dispara webhook Mobi via trigger PG) e atualiza contatos.status.
   */
  const mover = useCallback(
    async (leadId: string, statusAnterior: StatusLead, statusNovo: StatusLead) => {
      if (statusAnterior === statusNovo) return;
      // Otimista: move localmente.
      setColunas((cur) => {
        const clone = cur.map((c) => ({ ...c, items: [...c.items] }));
        const from = clone.find((c) => c.status === statusAnterior);
        const to = clone.find((c) => c.status === statusNovo);
        if (!from || !to) return cur;
        const idx = from.items.findIndex((i) => i.id === leadId);
        if (idx < 0) return cur;
        const [item] = from.items.splice(idx, 1);
        from.count = Math.max(0, from.count - 1);
        item.status = statusNovo;
        to.items.unshift(item);
        to.count += 1;
        return clone;
      });

      const prospeccao = prospeccaoIds.length === 1 ? prospeccaoIds[0] : null;
      const { error: err } = await supabase.rpc("mutate_contato_status_atomic", {
        p_contato: leadId,
        p_novo: statusNovo,
        p_anterior: statusAnterior,
        p_prospeccao: prospeccao,
        p_usuario: user?.id ?? null,
        p_obs: "Movimentação via Kanban Básico (v0)",
      });
      if (err) {
        console.error("kanban-basico: mover", err);
        // Reverte recarregando do servidor.
        await fetch();
        throw err;
      }
    },
    [prospeccaoIds.join(","), user?.id, fetch],
  );

  return { colunas, loading, error, refetch: fetch, mover };
}
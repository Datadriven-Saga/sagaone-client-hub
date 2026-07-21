import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DiagnosticoFiltros {
  terceiro_ids?: string[];
  empresa_ids?: string[];
  prospeccao_ids?: string[];
  seat_ids?: string[];
  data_de?: string | null;
  data_ate?: string | null;
}

export interface DiagnosticoOpcoes {
  empresas: { id: string; nome: string }[];
  prospeccoes: { id: string; titulo: string; empresa_id: string; data_fim: string | null; encerrado_at: string | null }[];
  terceiros: { id: string; nome: string; foto_url: string | null }[];
  seats: { id: string; profile_id: string; prospeccao_id: string; empresa_id: string }[];
}

export interface DiagnosticoKpis {
  total_leads: number;
  eventos_total: number;
  eventos_ativos: number;
  eventos_encerrados: number;
  eventos_pausados: number;
  eventos_expirados: number;
  eventos_expirados_leads_pendentes: number;
  leads_atribuidos: number;
  leads_nao_atribuidos: number;
  lojas_count: number;
  leads_por_loja: number;
  status_breakdown: Record<string, number>;
}

export interface DiagnosticoLead {
  contato_id: string;
  prospeccao_id: string;
  nome: string | null;
  telefone: string | null;
  empresa_id: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_foto: string | null;
  seat_id: string | null;
  evento_titulo: string;
  loja_nome: string | null;
  data_fim: string | null;
  encerrado_at: string | null;
  status_evento: string;
}

function toDefault(f: DiagnosticoFiltros): DiagnosticoFiltros {
  return {
    terceiro_ids: f.terceiro_ids ?? [],
    empresa_ids: f.empresa_ids ?? [],
    prospeccao_ids: f.prospeccao_ids ?? [],
    seat_ids: f.seat_ids ?? [],
    data_de: f.data_de ?? null,
    data_ate: f.data_ate ?? null,
  };
}

export function useDiagnosticoEventos() {
  const [opcoes, setOpcoes] = useState<DiagnosticoOpcoes | null>(null);
  const [kpis, setKpis] = useState<DiagnosticoKpis | null>(null);
  const [leads, setLeads] = useState<DiagnosticoLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const loadOpcoes = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("get_diagnostico_filtros_opcoes");
    if (error) {
      toast.error("Falha ao carregar filtros: " + error.message);
      return;
    }
    setOpcoes(data as DiagnosticoOpcoes);
  }, []);

  const fetchKpis = useCallback(async (filtros: DiagnosticoFiltros) => {
    setLoadingKpis(true);
    const { data, error } = await (supabase as any).rpc("get_diagnostico_eventos_kpis", { filtros: toDefault(filtros) });
    setLoadingKpis(false);
    if (error) {
      toast.error("Falha ao carregar KPIs: " + error.message);
      return;
    }
    setKpis(data as DiagnosticoKpis);
  }, []);

  const fetchLeads = useCallback(async (filtros: DiagnosticoFiltros, page: number, pageSize: number, search: string) => {
    setLoadingLeads(true);
    const { data, error } = await (supabase as any).rpc("get_diagnostico_eventos_leads", {
      filtros: toDefault(filtros),
      page_num: page,
      page_size: pageSize,
      search_term: search || null,
    });
    setLoadingLeads(false);
    if (error) {
      toast.error("Falha ao carregar leads: " + error.message);
      return;
    }
    setLeads((data?.rows ?? []) as DiagnosticoLead[]);
    setTotal(data?.total ?? 0);
  }, []);

  useEffect(() => { loadOpcoes(); }, [loadOpcoes]);

  return {
    opcoes,
    kpis,
    leads,
    total,
    loadingKpis,
    loadingLeads,
    fetchKpis,
    fetchLeads,
    reloadOpcoes: loadOpcoes,
  };
}

export const STATUS_ORDER = ["Novo","Atribuído","Em Espera","Convidado","Descartado","Confirmado","Check-in","Vendas","Opt-out"] as const;

export const STATUS_COLORS: Record<string, string> = {
  "Novo": "bg-sky-500",
  "Atribuído": "bg-blue-500",
  "Em Espera": "bg-amber-500",
  "Convidado": "bg-orange-500",
  "Descartado": "bg-red-500",
  "Confirmado": "bg-violet-500",
  "Check-in": "bg-emerald-500",
  "Vendas": "bg-teal-500",
  "Opt-out": "bg-zinc-500",
};

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    "Novo": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    "Atribuído": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    "Em Espera": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "Convidado": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    "Descartado": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    "Confirmado": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    "Check-in": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    "Vendas": "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    "Opt-out": "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

export function useMultiSelect<T extends string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const list = useMemo(() => Array.from(selected), [selected]);
  return { selected, toggle, clear, list, setSelected };
}
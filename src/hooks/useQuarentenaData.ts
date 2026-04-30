import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { toast } from "sonner";
import { differenceInDays, addDays, isAfter, isBefore } from "date-fns";
import { DateRange } from "react-day-picker";

export interface QuarentenaItem {
  id: string;
  telefone_normalizado: string;
  marca: string | null;
  empresa_id: string | null;
  evento_nome: string | null;
  prospeccao_id: string | null;
  data_fim_evento: string | null;
  ultimo_impacto_at: string;
  canal: string | null;
  created_at: string;
  updated_at: string;
  desativado: boolean;
  desativado_por: string | null;
  desativado_em: string | null;
  empresa_nome?: string;
  computed_status?: string;
}

export interface QuarentenaFilters {
  search: string;
  marcas: string[];
  lojas: string[];
  status: string;
  dateRange: DateRange | undefined;
  canal?: string;
}

export type QuarentenaStatus = "ativo" | "expirado" | "desativado";

export interface StatusInfo {
  status: QuarentenaStatus;
  daysLeft: number;
  label: string;
}

export function getQuarentenaStatus(item: QuarentenaItem, diasConfig?: number): StatusInfo {
  const dias = diasConfig ?? 30;

  if (item.computed_status) {
    if (item.computed_status === "desativado") {
      return { status: "desativado", daysLeft: 0, label: "Desativado" };
    }
    if (item.computed_status === "expirado") {
      return { status: "expirado", daysLeft: 0, label: "Expirada" };
    }
    if (item.data_fim_evento) {
      const dataFim = new Date(item.data_fim_evento);
      const now = new Date();
      if (isBefore(now, dataFim)) {
        return { status: "ativo", daysLeft: 0, label: "Evento ativo" };
      }
      const expiry = addDays(dataFim, dias);
      const daysLeft = differenceInDays(expiry, now);
      return { status: "ativo", daysLeft, label: `${daysLeft}d restantes` };
    }
    return { status: "ativo", daysLeft: 0, label: "Evento ativo" };
  }

  if (item.desativado) {
    return { status: "desativado", daysLeft: 0, label: "Desativado" };
  }
  if (!item.data_fim_evento) {
    return { status: "ativo", daysLeft: 0, label: "Evento ativo" };
  }
  const dataFim = new Date(item.data_fim_evento);
  const now = new Date();
  const expiry = addDays(dataFim, dias);

  if (isBefore(now, dataFim)) {
    return { status: "ativo", daysLeft: 0, label: "Evento ativo" };
  }
  if (isAfter(now, expiry)) {
    return { status: "expirado", daysLeft: 0, label: "Expirada" };
  }
  const daysLeft = differenceInDays(expiry, now);
  return { status: "ativo", daysLeft, label: `${daysLeft}d restantes` };
}

export function useQuarentenaData() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { isAdmin } = useUserAccessType();
  const [items, setItems] = useState<QuarentenaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<QuarentenaFilters>({
    search: "",
    marcas: [],
    lojas: [],
    status: "all",
    dateRange: undefined,
    canal: undefined,
  });
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>("ultimo_impacto_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const pageSize = 50;

  // Stats from server
  const [stats, setStats] = useState({ total: 0, ativos: 0, expirados: 0, desativados: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [availableMarcas, setAvailableMarcas] = useState<string[]>([]);
  const [availableLojas, setAvailableLojas] = useState<{ id: string; nome: string }[]>([]);
  const [activeFilteredCount, setActiveFilteredCount] = useState(0);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [filters.search]);

  // Reset page on filter change (except search which is debounced)
  useEffect(() => {
    setPage(1);
  }, [filters.marcas, filters.lojas, filters.status, filters.dateRange, filters.canal]);

  // Escopo agora é por MARCA (alinhado à regra de bloqueio).
  // A RPC `get_quarentena_paginated` aplica o filtro de marcas do usuário no servidor.
  // `companyFilter` permanece null para CRM — eles veem todas as lojas das marcas que têm acesso.
  const companyFilter: string | null = null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateTo = filters.dateRange?.to
        ? new Date(new Date(filters.dateRange.to).setHours(23, 59, 59, 999)).toISOString()
        : null;

      const { data, error } = await supabase.rpc("get_quarentena_paginated", {
        p_empresa_id: companyFilter || null,
        p_search: debouncedSearch || null,
        p_marcas: filters.marcas.length > 0 ? filters.marcas : null,
        p_lojas: filters.lojas.length > 0 ? filters.lojas : null,
        p_status: filters.status,
        p_date_from: filters.dateRange?.from?.toISOString() || null,
        p_date_to: dateTo,
        p_sort_column: sortColumn,
        p_sort_direction: sortDirection,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
        p_canal: filters.canal || null,
      });

      if (error) throw error;

      const result = data as any;
      setItems((result.items || []) as QuarentenaItem[]);
      setStats({
        total: result.total || 0,
        ativos: result.ativos || 0,
        expirados: result.expirados || 0,
        desativados: result.desativados || 0,
      });
      setTotalPages(Math.max(1, Math.ceil((result.total || 0) / pageSize)));
      setActiveFilteredCount(result.ativos || 0);
      setAvailableMarcas((result.availableMarcas || []) as string[]);
      setAvailableLojas((result.availableLojas || []) as { id: string; nome: string }[]);
    } catch (err) {
      console.error("Erro ao carregar quarentena:", err);
      toast.error("Erro ao carregar dados de quarentena");
    } finally {
      setLoading(false);
    }
  }, [companyFilter, debouncedSearch, filters.marcas, filters.lojas, filters.status, filters.dateRange, filters.canal, sortColumn, sortDirection, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeactivate = useCallback(async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("contato_quarentena")
        .update({
          desativado: true,
          desativado_por: user?.id || null,
          desativado_em: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) throw error;

      const logsToInsert = ids.map(id => {
        const item = items.find(i => i.id === id);
        return {
          quarentena_id: id,
          telefone_normalizado: item?.telefone_normalizado || "",
          marca: item?.marca || null,
          empresa_id: item?.empresa_id || null,
          acao: "desativado_manual",
          usuario_id: user?.id || null,
          usuario_email: user?.email || null,
          detalhes: `Quarentena desativada manualmente para ${item?.telefone_normalizado}`,
        };
      });

      await supabase.from("quarentena_logs").insert(logsToInsert);

      toast.success(`${ids.length} contato(s) liberado(s) da quarentena`);
      // Reload from server
      loadData();
    } catch (err) {
      console.error("Erro ao desativar:", err);
      toast.error("Erro ao desativar quarentena");
    }
  }, [items, user, loadData]);

  const handleDeactivateFiltered = useCallback(async () => {
    if (activeFilteredCount === 0) {
      toast.info("Nenhum contato ativo na quarentena com os filtros atuais");
      return;
    }

    // For bulk deactivate all filtered, we need to fetch the IDs server-side
    try {
      // Fetch all active IDs matching filter (only IDs, lightweight).
      // RLS já restringe por marca para não-admin; não filtramos por empresa_id aqui.
      let query = supabase
        .from("contato_quarentena")
        .select("id")
        .eq("desativado", false);

      if (filters.marcas.length > 0) query = query.in("marca", filters.marcas);
      if (filters.lojas.length > 0) query = query.in("empresa_id", filters.lojas);

      const { data: activeIds, error } = await query;
      if (error) throw error;

      if (!activeIds || activeIds.length === 0) {
        toast.info("Nenhum contato ativo encontrado");
        return;
      }

      const ids = activeIds.map(r => r.id);
      
      // Batch update in chunks of 500
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        await supabase
          .from("contato_quarentena")
          .update({
            desativado: true,
            desativado_por: user?.id || null,
            desativado_em: new Date().toISOString(),
          })
          .in("id", batch);
      }

      toast.success(`${ids.length} contato(s) liberado(s) da quarentena`);
      loadData();
    } catch (err) {
      console.error("Erro ao desativar em massa:", err);
      toast.error("Erro ao desativar quarentena em massa");
    }
  }, [activeFilteredCount, filters, user, loadData]);

  const toggleSort = useCallback((col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  }, [sortColumn]);

  return {
    items,
    loading,
    filters,
    setFilters,
    page,
    setPage,
    totalPages,
    pageSize,
    stats,
    availableMarcas,
    availableLojas,
    sortColumn,
    sortDirection,
    toggleSort,
    handleDeactivate,
    handleDeactivateFiltered,
    activeFilteredCount,
    reload: loadData,
  };
}

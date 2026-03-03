import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
}

export interface QuarentenaFilters {
  search: string;
  marcas: string[];
  lojas: string[];
  status: string;
  dateRange: DateRange | undefined;
}

export type QuarentenaStatus = "ativo" | "expirado" | "desativado";

export interface StatusInfo {
  status: QuarentenaStatus;
  daysLeft: number;
  label: string;
}

export function getQuarentenaStatus(item: QuarentenaItem): StatusInfo {
  if (item.desativado) {
    return { status: "desativado", daysLeft: 0, label: "Desativado" };
  }
  if (!item.data_fim_evento) {
    return { status: "ativo", daysLeft: 0, label: "Evento ativo" };
  }
  const dataFim = new Date(item.data_fim_evento);
  const now = new Date();
  const expiry = addDays(dataFim, 30);

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
  const [items, setItems] = useState<QuarentenaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<QuarentenaFilters>({
    search: "",
    marcas: [],
    lojas: [],
    status: "all",
    dateRange: undefined,
  });
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>("ultimo_impacto_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const pageSize = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const batchSize = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("contato_quarentena")
          .select("*, empresas!contato_quarentena_empresa_id_fkey(nome_empresa)")
          .order("ultimo_impacto_at", { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const mapped = allData.map((d: any) => ({
        ...d,
        empresa_nome: d.empresas?.nome_empresa || null,
      }));

      setItems(mapped as QuarentenaItem[]);
    } catch (err) {
      console.error("Erro ao carregar quarentena:", err);
      toast.error("Erro ao carregar dados de quarentena");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableMarcas = useMemo(() => {
    return [...new Set(items.map(d => d.marca).filter(Boolean))] as string[];
  }, [items]);

  const availableLojas = useMemo(() => {
    const lojaMap = new Map<string, string>();
    items.forEach(d => {
      if (d.empresa_id && d.empresa_nome) {
        lojaMap.set(d.empresa_id, d.empresa_nome);
      }
    });
    return Array.from(lojaMap.entries()).map(([id, nome]) => ({ id, nome }));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !filters.search ||
        item.telefone_normalizado?.includes(filters.search) ||
        item.evento_nome?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.marca?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.empresa_nome?.toLowerCase().includes(filters.search.toLowerCase());

      const matchMarca = filters.marcas.length === 0 || (item.marca && filters.marcas.includes(item.marca));
      const matchLoja = filters.lojas.length === 0 || (item.empresa_id && filters.lojas.includes(item.empresa_id));

      const statusInfo = getQuarentenaStatus(item);
      const matchStatus = filters.status === "all" || statusInfo.status === filters.status;

      let matchDate = true;
      if (filters.dateRange?.from) {
        const itemDate = new Date(item.data_fim_evento || item.ultimo_impacto_at);
        if (filters.dateRange.from) {
          matchDate = itemDate >= filters.dateRange.from;
        }
        if (filters.dateRange.to && matchDate) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          matchDate = itemDate <= endOfDay;
        }
      }

      return matchSearch && matchMarca && matchLoja && matchStatus && matchDate;
    });
  }, [items, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "telefone_normalizado": valA = a.telefone_normalizado; valB = b.telefone_normalizado; break;
        case "marca": valA = a.marca || ""; valB = b.marca || ""; break;
        case "empresa_nome": valA = a.empresa_nome || ""; valB = b.empresa_nome || ""; break;
        case "evento_nome": valA = a.evento_nome || ""; valB = b.evento_nome || ""; break;
        case "ultimo_impacto_at": valA = a.ultimo_impacto_at; valB = b.ultimo_impacto_at; break;
        case "data_fim_evento": valA = a.data_fim_evento || ""; valB = b.data_fim_evento || ""; break;
        default: valA = a.ultimo_impacto_at; valB = b.ultimo_impacto_at;
      }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  useEffect(() => { setPage(1); }, [filters]);

  const stats = useMemo(() => {
    const total = filtered.length;
    let ativos = 0, expirados = 0, desativados = 0;
    filtered.forEach(i => {
      const s = getQuarentenaStatus(i);
      if (s.status === "ativo") ativos++;
      else if (s.status === "expirado") expirados++;
      else desativados++;
    });
    return { total, ativos, expirados, desativados };
  }, [filtered]);

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

      // Log each action
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
      setItems(prev => prev.map(i =>
        ids.includes(i.id)
          ? { ...i, desativado: true, desativado_por: user?.id || null, desativado_em: new Date().toISOString() }
          : i
      ));
    } catch (err) {
      console.error("Erro ao desativar:", err);
      toast.error("Erro ao desativar quarentena");
    }
  }, [items, user]);

  const handleDeactivateFiltered = useCallback(async () => {
    const activeIds = filtered
      .filter(i => getQuarentenaStatus(i).status === "ativo")
      .map(i => i.id);

    if (activeIds.length === 0) {
      toast.info("Nenhum contato ativo na quarentena com os filtros atuais");
      return;
    }

    await handleDeactivate(activeIds);
  }, [filtered, handleDeactivate]);

  const toggleSort = useCallback((col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  }, [sortColumn]);

  return {
    items: paginated,
    allFiltered: filtered,
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
    reload: loadData,
  };
}

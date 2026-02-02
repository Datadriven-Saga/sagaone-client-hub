import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriLigacaoEvento {
  id_evento: number;
  nome?: string;
  evt_status?: unknown;
  data_inicio?: string;
  data_fim?: string;
  [key: string]: any;
}

function normalizeTelefonePri(value?: string | null): string {
  return (value || "").replace(/\D/g, "");
}

async function fetchPriLigacaoEventos(telefonePri: string): Promise<PriLigacaoEvento[]> {
  if (!telefonePri) return [];

  const { data, error } = await supabase.functions.invoke("eventos-ligacao-proxy", {
    body: {
      action: "listar_todos",
      telefone_pri: telefonePri,
    },
  });

  if (error) throw error;

  // Normalizar resposta (webhook pode devolver array direto ou objeto)
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if ((data as any).error || (data as any).message === "Error in workflow") {
      return [];
    }
    if (Array.isArray((data as any).eventos)) {
      return (data as any).eventos.filter((e: any) => e && (e.id_evento ?? e.id));
    }
  }

  if (Array.isArray(data)) {
    return data.filter((e: any) => e && (e.id_evento ?? e.id));
  }

  return [];
}

export function usePriLigacaoEventos(telefonePri?: string | null) {
  const telefone = normalizeTelefonePri(telefonePri);

  return useQuery({
    queryKey: ["pri-ligacao-eventos", telefone],
    queryFn: () => fetchPriLigacaoEventos(telefone),
    enabled: !!telefone,
    staleTime: 30_000,
    retry: 1,
  });
}

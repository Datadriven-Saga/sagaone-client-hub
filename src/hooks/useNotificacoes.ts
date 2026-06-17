import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CreateNotificationInput, Notification } from "@/lib/notifications/types";

/**
 * Hook central de notificações in-app.
 *
 * - Lê as notificações do usuário autenticado (RLS já filtra por user_id).
 * - Subscribe em realtime para refletir inserts/updates sem refresh.
 * - Expõe ações de marcar como lida e criar (raro no frontend).
 */
export function useNotificacoes() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (userId: string) => {
    const { data, error } = await (supabase as any)
      .from("notificacoes")
      .select("id,user_id,empresa_id,tipo,titulo,mensagem,link,lida,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[useNotificacoes] erro ao buscar:", error.message);
      setLista([]);
    } else {
      setLista((data || []) as Notification[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLista([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAll(user.id);

    const channel = supabase
      .channel(`notificacoes-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setLista((prev) => [payload.new as Notification, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLista((prev) => prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n)));
          } else if (payload.eventType === "DELETE") {
            setLista((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchAll]);

  const marcarComoLida = useCallback(async (id: string) => {
    setLista((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    await (supabase as any).from("notificacoes").update({ lida: true }).eq("id", id);
  }, []);

  const marcarTodasComoLidas = useCallback(async () => {
    if (!user?.id) return;
    setLista((prev) => prev.map((n) => ({ ...n, lida: true })));
    await (supabase as any)
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);
  }, [user?.id]);

  const criar = useCallback(async (input: CreateNotificationInput) => {
    const { error } = await (supabase as any).from("notificacoes").insert({
      user_id: input.user_id,
      empresa_id: input.empresa_id ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      mensagem: input.mensagem ?? null,
      link: input.link ?? null,
      lida: false,
    });
    if (error) console.error("[useNotificacoes] erro ao criar:", error.message);
  }, []);

  const naoLidas = lista.filter((n) => !n.lida).length;

  return {
    lista,
    naoLidas,
    total: lista.length,
    loading,
    marcarComoLida,
    marcarTodasComoLidas,
    criar,
    refresh: () => (user?.id ? fetchAll(user.id) : Promise.resolve()),
  };
}
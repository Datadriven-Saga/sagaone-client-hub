// Helper compartilhado para criar notificações in-app a partir de qualquer edge function.
// Use sempre o client criado com SERVICE_ROLE_KEY (já bypassa RLS).
//
// Exemplo:
//   import { inserirNotificacao } from "../_shared/notificacoes.ts";
//   await inserirNotificacao(supabase, {
//     user_id, empresa_id,
//     tipo: "disparo_falhou",
//     titulo: "Falha no disparo",
//     mensagem: "...",
//     link: `/prospeccao/${id}?job=${job_id}`,
//   });

export interface CreateNotificacaoInput {
  user_id: string;
  empresa_id?: string | null;
  tipo: string;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  /**
   * Quando true (default), evita duplicar uma notificação do mesmo `tipo` e mesmo `link`
   * para o mesmo usuário. Útil para jobs que podem reprocessar.
   */
  idempotenteByLink?: boolean;
}

export async function inserirNotificacao(
  supabase: any,
  input: CreateNotificacaoInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    if (!input.user_id) return { ok: false, error: "user_id obrigatório" };

    const idempotente = input.idempotenteByLink !== false && !!input.link;
    if (idempotente) {
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("user_id", input.user_id)
        .eq("tipo", input.tipo)
        .eq("link", input.link)
        .limit(1);
      if (existing && existing.length > 0) return { ok: true, skipped: true };
    }

    const { error } = await supabase.from("notificacoes").insert({
      user_id: input.user_id,
      empresa_id: input.empresa_id ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      mensagem: (input.mensagem ?? "").toString().substring(0, 240) || null,
      link: input.link ?? null,
      lida: false,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
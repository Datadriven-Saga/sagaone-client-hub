/**
 * Utilitários para envio de convite de confirmação de presença via WhatsApp.
 */

const CONFIRM_BASE_URL = "https://one.sagadatadriven.com.br/confirmar";

const DEFAULT_TEMPLATE =
  "Olá {{nome}}! 🎉\n\nVocê está convidado(a) para o evento *{{evento}}*.\n\n" +
  "Confirme sua presença pelo link abaixo:\n{{link}}\n\nAté lá!";

export function montarLinkConfirmacao(token: string): string {
  return `${CONFIRM_BASE_URL}/${token}`;
}

export function montarMensagemConvite(params: {
  template?: string | null;
  nome: string;
  evento: string;
  token: string;
}): string {
  const tpl = params.template?.trim() ? params.template : DEFAULT_TEMPLATE;
  return tpl
    .split("{{nome}}").join(params.nome || "")
    .split("{{evento}}").join(params.evento || "")
    .split("{{link}}").join(montarLinkConfirmacao(params.token));
}

/**
 * Normaliza um telefone BR para o formato esperado pelo wa.me (apenas dígitos com DDI 55).
 */
export function normalizarTelefoneWhatsapp(telefone: string): string {
  const digits = (telefone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function montarUrlWhatsapp(telefone: string, mensagem: string): string {
  const phone = normalizarTelefoneWhatsapp(telefone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

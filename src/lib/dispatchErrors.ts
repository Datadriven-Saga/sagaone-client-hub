/**
 * Mapeia mensagens cruas do dispatch-leads-webhook (e similares) para
 * mensagens amigáveis exibíveis em toast.
 *
 * Mantém o erro original em `raw` para debug.
 */
export interface FriendlyDispatchError {
  title: string;
  description: string;
  raw: string;
}

export function mapDispatchError(error: unknown): FriendlyDispatchError {
  const raw =
    (error as any)?.message ||
    (error as any)?.error ||
    (typeof error === 'string' ? error : '') ||
    'Erro desconhecido';
  const msg = String(raw).toLowerCase();

  // Template ausente / não configurado
  if (
    msg.includes('template de prospec') ||
    msg.includes('template_prospeccao') ||
    msg.includes('template não configurado') ||
    msg.includes('template nao configurado') ||
    msg.includes('não possui template')
  ) {
    return {
      title: 'Template de prospecção ausente',
      description:
        'Este evento não tem um template de WhatsApp vinculado. Edite o evento e selecione um template de prospecção aprovado antes de disparar.',
      raw,
    };
  }

  // event_id_pri ausente
  if (
    msg.includes('event_id_pri') ||
    msg.includes('identificador do evento') ||
    msg.includes('id do evento na pri')
  ) {
    return {
      title: 'Evento não sincronizado',
      description:
        'O evento não possui o identificador externo (event_id_pri). Reabra e salve o evento para sincronizar com a PRI antes de disparar.',
      raw,
    };
  }

  // Agente não configurado
  if (
    msg.includes('agente') &&
    (msg.includes('não') || msg.includes('nao') || msg.includes('inativo') || msg.includes('ausente'))
  ) {
    return {
      title: 'Agente não configurado',
      description:
        'Nenhum agente de WhatsApp ativo está vinculado a esta empresa. Vincule um agente em Administração → Agentes antes de disparar.',
      raw,
    };
  }

  // Disparos pausados
  if (msg.includes('disparos_pausados') || msg.includes('disparos pausados') || msg.includes('pausado')) {
    return {
      title: 'Disparos pausados',
      description:
        'Os disparos deste evento estão pausados. Verifique se há um template aprovado vinculado e libere o evento.',
      raw,
    };
  }

  // Fallback genérico
  return {
    title: 'Não foi possível enviar o disparo',
    description: String(raw).substring(0, 240),
    raw,
  };
}

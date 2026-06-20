import { Bell, CheckCircle2, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { NotificationTipo } from "./types";

export interface NotificationTypeMeta {
  label: string;
  icon: LucideIcon;
  // Tailwind classes para o badge / ícone
  badgeClass: string;
  iconClass: string;
}

/**
 * Registry de tipos de notificação.
 *
 * Para adicionar um tipo novo:
 *  1. Adicione a entrada aqui (label, ícone, cor).
 *  2. Use o `tipo` exato ao inserir na tabela `notificacoes` (via edge function ou frontend).
 * Pronto — sininho e página /notificacoes renderizam automaticamente.
 */
export const NOTIFICATION_REGISTRY: Record<string, NotificationTypeMeta> = {
  disparo_concluido: {
    label: "Disparo concluído",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconClass: "text-emerald-600",
  },
  disparo_falhou: {
    label: "Falha no disparo",
    icon: AlertTriangle,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    iconClass: "text-destructive",
  },
  disparo_retomado: {
    label: "Disparo retomado",
    icon: Info,
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    iconClass: "text-blue-600",
  },
  Sistema: {
    label: "Sistema",
    icon: Info,
    badgeClass: "bg-muted text-foreground border-border",
    iconClass: "text-muted-foreground",
  },
};

export const FALLBACK_META: NotificationTypeMeta = {
  label: "Notificação",
  icon: Bell,
  badgeClass: "bg-muted text-foreground border-border",
  iconClass: "text-muted-foreground",
};

export function getNotificationMeta(tipo: NotificationTipo): NotificationTypeMeta {
  return NOTIFICATION_REGISTRY[tipo] || FALLBACK_META;
}

export function listNotificationTypes(): Array<{ value: string; label: string }> {
  return Object.entries(NOTIFICATION_REGISTRY).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));
}
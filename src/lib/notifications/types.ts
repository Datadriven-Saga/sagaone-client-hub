export type NotificationTipo =
  | "disparo_concluido"
  | "disparo_falhou"
  | "Sistema"
  | string;

export interface Notification {
  id: string;
  user_id: string;
  empresa_id: string | null;
  tipo: NotificationTipo;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  empresa_id?: string | null;
  tipo: NotificationTipo;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
}
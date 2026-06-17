import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { getNotificationMeta } from "@/lib/notifications/registry";
import type { Notification } from "@/lib/notifications/types";

export default function NotificacoesBell() {
  const navigate = useNavigate();
  const { lista, naoLidas, loading, marcarComoLida, marcarTodasComoLidas } = useNotificacoes();
  const ultimas = lista.slice(0, 8);

  const onClickItem = async (n: Notification) => {
    if (!n.lida) await marcarComoLida(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 md:h-9 md:w-9"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-[1.1rem] text-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notificações</div>
          <div className="flex items-center gap-2">
            {naoLidas > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => marcarTodasComoLidas()}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
          ) : ultimas.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Você está em dia. Nenhuma notificação.
            </div>
          ) : (
            <ul className="divide-y">
              {ultimas.map((n) => {
                const meta = getNotificationMeta(n.tipo);
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => onClickItem(n)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-muted/60 flex items-start gap-2 transition-colors",
                        !n.lida && "bg-primary/[0.04]"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.iconClass)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{n.titulo}</span>
                          {!n.lida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        {n.mensagem && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.mensagem}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t px-3 py-2 flex justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/notificacoes")}>
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Silence unused warning when Badge isn't used here
void Badge;
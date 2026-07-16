import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import {
  getNotificationMeta,
  listNotificationTypes,
} from "@/lib/notifications/registry";

type Filter = "todas" | "nao_lidas" | string;

const Notificacoes = () => {
  const navigate = useNavigate();
  const { lista, naoLidas, total, loading, marcarComoLida, marcarTodasComoLidas } =
    useNotificacoes();
  const [filtro, setFiltro] = useState<Filter>("todas");

  const tipos = useMemo(() => listNotificationTypes(), []);

  const filtrada = useMemo(() => {
    if (filtro === "todas") return lista;
    if (filtro === "nao_lidas") return lista.filter((n) => !n.lida);
    return lista.filter((n) => n.tipo === filtro);
  }, [lista, filtro]);

  const handleAbrir = async (id: string, link: string | null, lida: boolean) => {
    if (!lida) await marcarComoLida(id);
    if (link) navigate(link);
  };

  return (
    <DashboardLayout title="Notificações">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KPICard
            title="Não lidas"
            value={loading ? "..." : naoLidas.toString()}
            icon={Bell}
          />
          <KPICard
            title="Total"
            value={loading ? "..." : total.toString()}
            icon={BellOff}
          />
        </div>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Select value={filtro} onValueChange={(v) => setFiltro(v as Filter)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="nao_lidas">Não lidas</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {naoLidas > 0 && (
              <Button variant="outline" size="sm" onClick={() => marcarTodasComoLidas()}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Carregando notificações…
            </div>
          ) : filtrada.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma notificação para este filtro.
            </div>
          ) : (
            <ul className="divide-y">
              {filtrada.map((n) => {
                const meta = getNotificationMeta(n.tipo);
                const Icon = meta.icon;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "py-3 px-2 flex items-start gap-3 hover:bg-muted/40 transition-colors rounded",
                      !n.lida && "bg-primary/[0.04]"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", meta.iconClass)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{n.titulo}</span>
                        <Badge variant="outline" className={cn("text-[10px]", meta.badgeClass)}>
                          {meta.label}
                        </Badge>
                        {!n.lida && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.mensagem && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {n.mensagem}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {n.link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrir(n.id, n.link, n.lida)}
                        >
                          Abrir
                        </Button>
                      )}
                      {!n.lida && !n.link && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => marcarComoLida(n.id)}
                        >
                          Marcar lida
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Notificacoes;
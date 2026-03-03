import { ShieldAlert, Clock, Calendar, ShieldOff } from "lucide-react";

interface Props {
  total: number;
  ativos: number;
  expirados: number;
  desativados: number;
}

export function QuarentenaStats({ total, ativos, expirados, desativados }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
        <ShieldAlert className="h-7 w-7 text-amber-500 shrink-0" />
        <div>
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total registros</p>
        </div>
      </div>
      <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
        <Clock className="h-7 w-7 text-destructive shrink-0" />
        <div>
          <p className="text-2xl font-bold">{ativos}</p>
          <p className="text-xs text-muted-foreground">Quarentena ativa</p>
        </div>
      </div>
      <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
        <Calendar className="h-7 w-7 text-green-500 shrink-0" />
        <div>
          <p className="text-2xl font-bold">{expirados}</p>
          <p className="text-xs text-muted-foreground">Expiradas</p>
        </div>
      </div>
      <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
        <ShieldOff className="h-7 w-7 text-muted-foreground shrink-0" />
        <div>
          <p className="text-2xl font-bold">{desativados}</p>
          <p className="text-xs text-muted-foreground">Desativados</p>
        </div>
      </div>
    </div>
  );
}

import { ColunaData, StatusLead } from "./useKanbanBasico";
import { KanbanBasicoCard } from "./KanbanBasicoCard";

interface Props {
  coluna: ColunaData;
  onMover: (leadId: string, anterior: StatusLead, novo: StatusLead) => void | Promise<void>;
}

export function KanbanBasicoColumn({ coluna, onMover }: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/30 min-w-[260px] max-w-[280px] flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <h3 className="text-sm font-semibold truncate">{coluna.titulo}</h3>
        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full min-w-[24px] text-center">
          {coluna.count}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {coluna.items.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            Nenhum lead
          </div>
        ) : (
          coluna.items.map((lead) => (
            <KanbanBasicoCard
              key={lead.id}
              lead={lead}
              onMover={(novo) => onMover(lead.id, coluna.status, novo)}
            />
          ))
        )}
        {coluna.count > coluna.items.length && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            Mostrando {coluna.items.length} de {coluna.count}
          </div>
        )}
      </div>
    </div>
  );
}
import { ColunaData, StatusLead } from "./useKanbanBasico";
import { KanbanBasicoColumn } from "./KanbanBasicoColumn";

interface Props {
  colunas: ColunaData[];
  onMover: (leadId: string, anterior: StatusLead, novo: StatusLead) => void | Promise<void>;
}

export function KanbanBasicoBoard({ colunas, onMover }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {colunas.map((c) => (
        <KanbanBasicoColumn key={c.status} coluna={c} onMover={onMover} />
      ))}
    </div>
  );
}
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { COLUNAS, LeadCard, StatusLead } from "./useKanbanBasico";

interface Props {
  lead: LeadCard;
  onMover: (novo: StatusLead) => void | Promise<void>;
}

export function KanbanBasicoCard({ lead, onMover }: Props) {
  const [busy, setBusy] = useState(false);
  const handle = async (novo: StatusLead) => {
    if (novo === lead.status) return;
    setBusy(true);
    try {
      await onMover(novo);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-2 space-y-1 text-sm">
      <div className="font-medium truncate">{lead.nome}</div>
      <div className="text-xs text-muted-foreground truncate">{lead.telefone}</div>
      {lead.responsavel_email && (
        <div className="text-xs text-muted-foreground truncate">
          {lead.responsavel_email}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs justify-between"
            disabled={busy}
          >
            Mover
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {COLUNAS.filter((c) => c.status !== lead.status).map((c) => (
            <DropdownMenuItem key={c.status} onClick={() => handle(c.status)}>
              {c.titulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
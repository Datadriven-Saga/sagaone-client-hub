import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { PatyAgente } from "@/types/pos-vendas";

interface Props {
  agentes: PatyAgente[];
  value: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
}

export function AgenteSelector({ agentes, value, onChange, loading }: Props) {
  return (
    <div className="space-y-2 max-w-md">
      <Label>Agente Paty</Label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando agentes...
        </div>
      ) : agentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum agente Paty configurado nesta empresa.
        </p>
      ) : (
        <Select value={value ?? undefined} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
          <SelectContent>
            {agentes.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
                {a.marca || a.uf ? ` · ${[a.marca, a.uf].filter(Boolean).join(" / ")}` : ""}
                {a.telefone ? ` · ${a.telefone}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
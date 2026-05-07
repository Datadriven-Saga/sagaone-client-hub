import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CUSTO_POR_CATEGORIA } from "@/constants/pos-vendas-gatilhos";
import type { PatyTemplate } from "@/types/pos-vendas";

interface Props {
  templates: PatyTemplate[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TemplateSelectApproved({ templates, value, onChange, placeholder, disabled }: Props) {
  const selected = templates.find(t => t.id === value);
  const categoria = selected?.category_meta || selected?.categoria || "";
  const custo = CUSTO_POR_CATEGORIA[categoria.toUpperCase()] ?? null;

  return (
    <div className="space-y-1">
      <Select value={value ?? undefined} onValueChange={(v) => onChange(v)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? "Selecione um template aprovado"} />
        </SelectTrigger>
        <SelectContent>
          {templates.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum template aprovado</div>
          ) : templates.map(t => {
            const cat = (t.category_meta || t.categoria || "").toUpperCase();
            const c = CUSTO_POR_CATEGORIA[cat];
            return (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span>{t.nome}</span>
                  {cat && <span className="text-xs text-muted-foreground">· {cat}</span>}
                  {c != null && <span className="text-xs text-muted-foreground">~${c.toFixed(4)}</span>}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {selected && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{categoria || "—"}</Badge>
          {custo != null && <span>≈ ${custo.toFixed(4)} USD/disparo</span>}
        </div>
      )}
    </div>
  );
}